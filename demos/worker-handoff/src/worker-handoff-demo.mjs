import { createMissionProfile } from '@kevinmarmstrong/edgekit'
import { createHandoffEnvelope } from '@kevinmarmstrong/edgekit-agui'
import {
  applyRedactors,
  createAuditTrail,
  createPiiRedactor,
  createToolPolicyExecutor,
} from '@kevinmarmstrong/edgekit-governance'

const SERVER_ONLY_SIGNALS = [
  'warehouse',
  'export',
  'quarterly',
  'billing variance',
  'compliance',
  'email finance',
]

const LOCAL_TASK_SIGNALS = [
  'visible dashboard',
  'current page',
  'summarize alerts',
  'filter local',
]

const SECRET_KEYS = new Set(['authToken', 'apiKey', 'secretNotes', 'rawCustomerEmail'])
const MAX_HANDOFF_INPUT_CHARS = 260

function capHandoffText(value, maxChars = MAX_HANDOFF_INPUT_CHARS) {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars - ' [TRUNCATED]'.length).trimEnd()} [TRUNCATED]`
}

export function createWorkerHandoffMissionProfile() {
  return createMissionProfile({
    id: 'worker-handoff-v1',
    mission: 'worker-handoff',
    version: '1.0.0',
    systemPrompt:
      'Start in local-browser mode for bounded app tasks. Escalate only when server authority is required. Explain mode transitions, bound handoff context, enforce policy, and record telemetry.',
    requiredTools: ['summarizeVisibleDashboard', 'generateBillingVarianceReport'],
    defaults: {
      toolChoice: 'required',
      downloadPolicy: 'never',
    },
  })
}

export function classifyTask(input) {
  const normalizedInput = input.toLowerCase()
  const needsServerCapability = SERVER_ONLY_SIGNALS.some((signal) => normalizedInput.includes(signal))
  if (needsServerCapability) {
    return {
      route: 'handoff',
      reason:
        'The task requires server-side warehouse access, durable audit, and app-owned Worker tools that are outside local/basic browser capability.',
      requiredMode: 'app-owned-worker',
    }
  }

  const isBoundedLocalTask = LOCAL_TASK_SIGNALS.some((signal) => normalizedInput.includes(signal))
  return {
    route: 'local',
    reason: isBoundedLocalTask
      ? 'The task is bounded to visible host-app state and can run in local-browser mode.'
      : 'The task did not ask for server-only data or privileged tools, so local-browser mode is attempted first.',
    requiredMode: 'local-browser',
  }
}

export function createSampleAppState() {
  return {
    workspaceId: 'acme-finance-demo',
    currentView: 'billing-dashboard',
    visibleAlerts: [
      { id: 'alert-1', severity: 'high', title: 'Enterprise overage rose 18%' },
      { id: 'alert-2', severity: 'medium', title: 'Invoice sync retry pending' },
    ],
    selectedQuarter: '2026-Q2',
    authToken: 'secret_token_should_not_cross_boundary',
    apiKey: 'secret_api_key_should_not_cross_boundary',
    secretNotes: 'do not reveal renewal negotiation floor',
    rawCustomerEmail: 'finance-lead@example.com',
  }
}

export async function boundedHandoffContext({ input, appState, redactor, trace }) {
  const redactedInput = capHandoffText(
    await applyRedactors(input, redactor, {
      sessionId: trace.sessionId,
      runId: trace.runId,
      identity: { id: 'demo-user', role: 'finance-operator' },
      state: { workspaceId: appState.workspaceId },
      phase: 'handoff-input',
    }),
  )
  const redactedVisibleAlerts = await applyRedactors(appState.visibleAlerts, redactor, {
    sessionId: trace.sessionId,
    runId: trace.runId,
    identity: { id: 'demo-user', role: 'finance-operator' },
    state: { workspaceId: appState.workspaceId },
    phase: 'telemetry',
  })

  const includedAppState = {
    workspaceId: appState.workspaceId,
    currentView: appState.currentView,
    selectedQuarter: appState.selectedQuarter,
    visibleAlerts: redactedVisibleAlerts,
  }

  return {
    input: redactedInput,
    intent: 'Generate billing variance report from server-owned finance warehouse, then return a user-visible summary.',
    messages: [
      {
        role: 'user',
        content: redactedInput,
      },
    ],
    session: {
      identity: {
        id: 'demo-user',
        role: 'finance-operator',
        permissions: ['billing:read', 'reports:request'],
      },
      state: includedAppState,
    },
    memory: [
      {
        id: 'handoff-policy-note',
        title: 'Worker handoff policy',
        body: 'Escalate only for server-only tools. Never include tokens, API keys, raw customer email, or hidden notes in the handoff envelope.',
        tags: ['policy', 'handoff'],
        source: 'demo-manifest',
        updatedAt: '2026-05-29T00:00:00.000Z',
      },
    ],
    tools: [
      { name: 'generateBillingVarianceReport', description: 'App-owned Worker tool with warehouse access.' },
      { name: 'recordBillingReportAudit', description: 'App-owned audit writer.' },
    ],
    trace,
    redactionApplied: true,
    excludedSecretKeys: Object.keys(appState).filter((key) => SECRET_KEYS.has(key)),
  }
}

export function hasSecretLeak(value) {
  const serialized = JSON.stringify(value)
  return [
    'secret_token_should_not_cross_boundary',
    'secret_api_key_should_not_cross_boundary',
    'do not reveal renewal negotiation floor',
    'finance-lead@example.com',
    'authToken',
    'apiKey',
    'secretNotes',
    'rawCustomerEmail',
  ].some((secret) => serialized.includes(secret))
}

export function createDemoWorkerTools({ telemetry, auditTrail }) {
  return {
    generateBillingVarianceReport: {
      async execute(input, context) {
        auditTrail.record({
          action: 'tool-call',
          sessionId: context.sessionId,
          runId: context.runId,
          toolName: 'generateBillingVarianceReport',
          input: {
            workspaceId: input.workspaceId,
            quarter: input.quarter,
          },
        })

        const report = {
          reportId: 'variance-2026-q2-demo',
          workspaceId: input.workspaceId,
          quarter: input.quarter,
          highlights: [
            'Enterprise overage variance: +18%',
            'Invoice sync retry queue requires operator review',
          ],
          policyOutcome: 'allowed',
        }

        telemetry.push({
          type: 'tool.outcome',
          mode: 'app-owned-worker',
          toolName: 'generateBillingVarianceReport',
          policyOutcome: 'allowed',
          reportId: report.reportId,
        })
        auditTrail.record({
          action: 'tool-result',
          sessionId: context.sessionId,
          runId: context.runId,
          toolName: 'generateBillingVarianceReport',
          output: report,
        })
        return report
      },
    },
  }
}

export async function handleLocalTask({ input, appState, telemetry }) {
  telemetry.push({
    type: 'mode.detected',
    mode: 'local-browser',
    reason: 'bounded visible host-app state',
  })

  return {
    mode: 'local-browser',
    userFacingMode: 'Local/browser mode: bounded to visible app state; no Worker handoff required.',
    answer: `Visible dashboard has ${appState.visibleAlerts.length} alerts: ${appState.visibleAlerts
      .map((alert) => alert.title)
      .join('; ')}.`,
    handoff: null,
  }
}

export async function handleWorkerHandoff({ input, appState = createSampleAppState() }) {
  const telemetry = []
  const trace = { sessionId: 'worker-handoff-demo-session', runId: 'run-worker-handoff-001', phase: 'send' }
  const redactor = createPiiRedactor({
    email: true,
    phone: true,
    ssn: true,
    creditCard: true,
    customPatterns: [
      { name: 'secret-token', pattern: /secret_[a-z_]+/gi, replacement: '[REDACTED:secret]' },
    ],
  })
  const auditTrail = createAuditTrail({ sessionId: trace.sessionId })
  const classification = classifyTask(input)

  telemetry.push({
    type: 'mode.detected',
    mode: 'local-browser',
    classification: classification.route,
    reason: classification.reason,
  })

  if (classification.route === 'local') {
    return handleLocalTask({ input, appState, telemetry })
  }

  const context = await boundedHandoffContext({ input, appState, redactor, trace })
  telemetry.push({
    type: 'handoff.context_bounded',
    mode: 'local-browser',
    boundedContextKeys: Object.keys(context.session.state),
    excludedSecretKeys: context.excludedSecretKeys,
    redactionApplied: true,
  })

  const envelope = createHandoffEnvelope(context)
  if (hasSecretLeak(envelope)) {
    throw new Error('bounded handoff context leaked a secret')
  }

  telemetry.push({
    type: 'mode.transition',
    from: 'local-browser',
    to: 'app-owned-worker',
    reason: classification.reason,
    envelopeId: envelope.id,
    approximateTokens: envelope.approximateTokens,
  })

  const policyExecutor = createToolPolicyExecutor({
    defaultPolicy: {
      allowedTools: ['generateBillingVarianceReport'],
      timeoutMs: 1_000,
      maxInputBytes: 2_000,
      maxOutputBytes: 4_000,
    },
  })
  const workerTools = createDemoWorkerTools({ telemetry, auditTrail })
  const report = await policyExecutor.execute({
    toolName: 'generateBillingVarianceReport',
    tool: workerTools.generateBillingVarianceReport,
    input: {
      workspaceId: envelope.session.state.workspaceId,
      quarter: envelope.session.state.selectedQuarter,
    },
    context: {
      sessionId: trace.sessionId,
      runId: trace.runId,
      identity: envelope.session.identity,
      state: envelope.session.state,
    },
  })

  telemetry.push({
    type: 'server_route.completed',
    mode: 'app-owned-worker',
    route: '/api/edgekit/worker-handoff',
    outcome: 'report-generated',
    reportId: report.reportId,
  })

  return {
    mode: 'app-owned-worker',
    userFacingMode:
      'Escalated from Local/browser mode to app-owned Worker mode because the request needs server-only finance warehouse access, policy enforcement, telemetry, and audit.',
    handoff: {
      route: '/api/edgekit/worker-handoff',
      reason: classification.reason,
      envelope,
    },
    policy: {
      allowedTools: ['generateBillingVarianceReport'],
      outcome: report.policyOutcome,
    },
    report,
    telemetry,
    auditEntries: auditTrail.entries(),
  }
}

export async function runDemo() {
  const missionProfile = createWorkerHandoffMissionProfile()
  const localResult = await handleWorkerHandoff({
    input: 'Summarize alerts on the visible dashboard from the current page.',
  })
  const handoffResult = await handleWorkerHandoff({
    input: 'Export a quarterly billing variance report from the finance warehouse and explain what changed.',
  })

  return {
    missionProfile: {
      id: missionProfile.id,
      mission: missionProfile.mission,
      version: missionProfile.version,
    },
    localResult,
    handoffResult,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runDemo()
  console.log(JSON.stringify(result, null, 2))
}
