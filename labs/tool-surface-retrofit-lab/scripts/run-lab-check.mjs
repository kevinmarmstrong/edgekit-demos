import assert from 'node:assert/strict'

import {
  createDispatchBoardApp,
  createRetrofitToolSurface,
  runAgentUserWorkflow,
  summarizeFriction,
} from '../src/index.mjs'

const app = createDispatchBoardApp()
const surface = createRetrofitToolSurface({ app, approveRiskyMutation: () => true })
const result = await runAgentUserWorkflow(surface, {
  workOrderId: 'WO-1042',
  operatorPrompt: 'Handle the water leak at East Lofts today.',
})

assert.equal(result.status, 'completed')
assert.equal(result.claims.every((claim) => claim.evidence.length > 0), true)
assert.equal(app.audit().every((event) => event.adapter?.startsWith('host.actions.')), true)
assert.equal(surface.audit.entries().some((entry) => entry.event.action === 'approval-decision' && entry.event.approved === true), true)
assert.equal(summarizeFriction().reusableEdgekitFriction.length, 2)

console.log(JSON.stringify({
  lab: 'tool-surface-retrofit-lab',
  workflowStatus: result.status,
  assignedTechnician: app.selectors.getWorkOrder('WO-1042').assignment.technicianId,
  telemetryEvents: surface.telemetry.length,
  auditEntries: surface.audit.entries().length,
  hostMutations: app.audit().length,
  reusableFriction: summarizeFriction().reusableEdgekitFriction.map((item) => item.title),
}, null, 2))
