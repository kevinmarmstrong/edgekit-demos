import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createDispatchBoardApp,
  createRetrofitToolSurface,
  runAgentUserWorkflow,
  summarizeFriction,
} from '../src/index.mjs'

const allowedClassifications = new Set([
  'app-specific integration',
  'docs/onboarding gap',
  'missing primitive',
  'weak default',
  'core bug',
  'eval/test gap',
])

test('agent workflow reads app state before making workflow claims', async () => {
  const app = createDispatchBoardApp()
  const surface = createRetrofitToolSurface({ app, approveRiskyMutation: () => true })

  const result = await runAgentUserWorkflow(surface, {
    workOrderId: 'WO-1042',
    operatorPrompt: 'Handle the water leak at East Lofts today.',
  })

  assert.equal(result.claims.length > 0, true)
  for (const claim of result.claims) {
    assert.equal(claim.evidence.some((eventId) => eventId.startsWith('tool-result:readWorkOrder')), true, `${claim.text} lacks work-order read evidence`)
  }

  const firstRead = surface.telemetry.findIndex((event) => event.type === 'tool-result' && event.toolName === 'readWorkOrder')
  const firstClaim = surface.telemetry.findIndex((event) => event.type === 'claim')
  assert.notEqual(firstRead, -1)
  assert.notEqual(firstClaim, -1)
  assert.equal(firstRead < firstClaim, true, 'claim happened before app-owned read result')
})

test('risky same-day scheduling is approval gated and denial prevents mutation', async () => {
  const app = createDispatchBoardApp()
  const surface = createRetrofitToolSurface({ app, approveRiskyMutation: () => false })

  const before = app.selectors.getWorkOrder('WO-1042')
  const result = await runAgentUserWorkflow(surface, {
    workOrderId: 'WO-1042',
    operatorPrompt: 'Handle the water leak at East Lofts today.',
  })
  const after = app.selectors.getWorkOrder('WO-1042')

  assert.equal(result.status, 'blocked-by-approval')
  assert.deepEqual(after.assignment, before.assignment)
  assert.equal(app.audit().some((event) => event.action === 'scheduleSameDayVisit'), false)
  assert.equal(surface.telemetry.some((event) => event.type === 'approval-decision' && event.approved === false), true)
})

test('approved mutation goes through host-owned action adapter and writes audit/telemetry', async () => {
  const app = createDispatchBoardApp()
  const surface = createRetrofitToolSurface({ app, approveRiskyMutation: () => true })

  const result = await runAgentUserWorkflow(surface, {
    workOrderId: 'WO-1042',
    operatorPrompt: 'Handle the water leak at East Lofts today.',
  })

  const after = app.selectors.getWorkOrder('WO-1042')
  assert.equal(result.status, 'completed')
  assert.equal(after.assignment.technicianId, 'TECH-PLUMBING-1')
  assert.equal(after.assignment.window, 'today-2pm-4pm')

  assert.deepEqual(app.audit().map((event) => event.adapter), ['host.actions.scheduleSameDayVisit'])
  assert.equal(surface.telemetry.some((event) => event.type === 'tool-call' && event.toolName === 'scheduleSameDayVisit'), true)
  assert.equal(surface.telemetry.some((event) => event.type === 'tool-result' && event.toolName === 'scheduleSameDayVisit'), true)
  assert.equal(surface.telemetry.some((event) => event.type === 'approval-request' && event.toolName === 'scheduleSameDayVisit'), true)
})

test('friction summary classifies every workaround and separates reusable Edgekit friction', () => {
  const summary = summarizeFriction()

  assert.equal(summary.workarounds.length >= 3, true)
  for (const item of summary.workarounds) {
    assert.equal(allowedClassifications.has(item.classification), true, `${item.title} has invalid classification`)
    assert.equal(typeof item.evidence, 'string')
    assert.notEqual(item.evidence.length, 0)
  }

  assert.deepEqual(
    summary.reusableEdgekitFriction.map((item) => item.classification),
    ['missing primitive', 'eval/test gap'],
  )
  assert.equal(summary.appSpecificIntegration.every((item) => item.classification === 'app-specific integration'), true)
})
