import { createAuditTrail, createToolPolicyExecutor } from '@kevinmarmstrong/edgekit-governance'

function clone(value) {
  return value == null ? value : structuredClone(value)
}

function createEventRecorder(telemetry) {
  let sequence = 0
  return function record(event) {
    sequence += 1
    const id = `${event.type}:${event.toolName ?? event.action ?? 'workflow'}:${sequence}`
    const entry = {
      id,
      timestamp: new Date().toISOString(),
      ...event,
    }
    telemetry.push(entry)
    return entry
  }
}

export function createRetrofitToolSurface({ app, approveRiskyMutation = () => false } = {}) {
  if (!app) throw new Error('createRetrofitToolSurface requires the host app instance')

  const telemetry = []
  const audit = createAuditTrail({ sessionId: 'tool-surface-retrofit-lab' })
  const policyExecutor = createToolPolicyExecutor({
    defaultPolicy: {
      allowedTools: ['readWorkOrder', 'listTechnicians', 'scheduleSameDayVisit'],
      maxInputBytes: 4096,
      maxOutputBytes: 16384,
      timeoutMs: 5000,
    },
  })
  const record = createEventRecorder(telemetry)

  async function executeTool(toolName, input, execute) {
    const callEvent = record({ type: 'tool-call', toolName, input: clone(input) })
    await audit.record({ action: 'tool-call', sessionId: 'tool-surface-retrofit-lab', toolName, input })

    try {
      const output = await policyExecutor.execute({
        toolName,
        tool: { execute },
        input,
        context: { sessionId: 'tool-surface-retrofit-lab' },
      })
      const resultEvent = record({ type: 'tool-result', toolName, input: clone(input), output: clone(output), callEventId: callEvent.id })
      await audit.record({ action: 'tool-result', sessionId: 'tool-surface-retrofit-lab', toolName, output })
      return { output, eventId: resultEvent.id }
    } catch (error) {
      record({ type: 'tool-error', toolName, input: clone(input), error: error.message, callEventId: callEvent.id })
      await audit.record({ action: 'error', sessionId: 'tool-surface-retrofit-lab', toolName, reason: error.message })
      throw error
    }
  }

  const tools = {
    readWorkOrder: {
      description: 'Read one work order from the host dispatch board before making workflow claims.',
      execute: async ({ workOrderId }) => executeTool('readWorkOrder', { workOrderId }, () => app.selectors.getWorkOrder(workOrderId)),
    },
    listTechnicians: {
      description: 'Read host-owned technician availability for the needed skill.',
      execute: async ({ skill }) => executeTool('listTechnicians', { skill }, () => app.selectors.listTechnicians({ skill })),
    },
    scheduleSameDayVisit: {
      description: 'Approval-gated mutation that schedules through the host app action adapter only.',
      execute: async ({ workOrderId, technicianId, window, reason }) => {
        const approvalRequest = record({
          type: 'approval-request',
          toolName: 'scheduleSameDayVisit',
          input: { workOrderId, technicianId, window, reason },
        })
        await audit.record({
          action: 'approval-request',
          sessionId: 'tool-surface-retrofit-lab',
          toolName: 'scheduleSameDayVisit',
          input: { workOrderId, technicianId, window, reason },
          reason,
        })

        const approved = Boolean(await approveRiskyMutation({ workOrderId, technicianId, window, reason, approvalRequestId: approvalRequest.id }))
        const approvalId = approved ? `approval-${approvalRequest.id}` : null
        record({ type: 'approval-decision', toolName: 'scheduleSameDayVisit', approved, approvalId })
        await audit.record({
          action: 'approval-decision',
          sessionId: 'tool-surface-retrofit-lab',
          toolName: 'scheduleSameDayVisit',
          approved,
          reason: approved ? 'operator approved same-day dispatch' : 'operator denied same-day dispatch',
        })

        if (!approved) {
          return {
            output: { approved: false, blocked: true, reason: 'same-day occupied-building dispatch requires operator approval' },
            eventId: approvalRequest.id,
          }
        }

        return executeTool(
          'scheduleSameDayVisit',
          { workOrderId, technicianId, window, approvalId },
          () => app.actions.scheduleSameDayVisit({ workOrderId, technicianId, window, approvalId }),
        )
      },
    },
  }

  function claim(text, evidence) {
    const event = record({ type: 'claim', text, evidence: [...evidence] })
    return { text, evidence: [...evidence], eventId: event.id }
  }

  return {
    app,
    audit,
    telemetry,
    tools,
    claim,
  }
}

export async function runAgentUserWorkflow(surface, { workOrderId, operatorPrompt }) {
  const claims = []
  const read = await surface.tools.readWorkOrder.execute({ workOrderId })
  const workOrder = read.output

  claims.push(surface.claim(
    `${workOrder.title} affects ${workOrder.building} ${workOrder.unit} and needs ${workOrder.requiredSkill}.`,
    [read.eventId],
  ))
  claims.push(surface.claim(
    `The tenant impact makes this a same-day workflow: ${workOrder.tenantImpact}.`,
    [read.eventId],
  ))

  const techs = await surface.tools.listTechnicians.execute({ skill: workOrder.requiredSkill })
  const technician = techs.output.find((candidate) => candidate.windows.includes('today-2pm-4pm')) ?? techs.output[0]
  if (!technician) {
    return {
      status: 'blocked-no-technician',
      operatorPrompt,
      claims,
      reason: `No technician is available for ${workOrder.requiredSkill}`,
    }
  }

  claims.push(surface.claim(
    `${technician.name} is the first available ${workOrder.requiredSkill} technician for today.`,
    [read.eventId, techs.eventId],
  ))

  const mutation = await surface.tools.scheduleSameDayVisit.execute({
    workOrderId,
    technicianId: technician.id,
    window: 'today-2pm-4pm',
    reason: `Same-day dispatch for ${workOrder.building} requires approval because it changes occupied-building operations.`,
  })

  if (mutation.output?.blocked) {
    return {
      status: 'blocked-by-approval',
      operatorPrompt,
      claims,
      reason: mutation.output.reason,
    }
  }

  return {
    status: 'completed',
    operatorPrompt,
    claims,
    mutationEventId: mutation.eventId,
    finalWorkOrder: mutation.output,
  }
}
