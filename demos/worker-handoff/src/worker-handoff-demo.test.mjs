import assert from 'node:assert/strict'
import {
  createSampleAppState,
  handleWorkerHandoff,
  hasSecretLeak,
  runDemo,
} from './worker-handoff-demo.mjs'

const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

test('handles bounded app tasks locally', async () => {
  const result = await handleWorkerHandoff({
    input: 'Summarize alerts on the visible dashboard from the current page.',
  })

  assert.equal(result.mode, 'local-browser')
  assert.equal(result.handoff, null)
  assert.match(result.userFacingMode, /Local\/browser mode/)
  assert.match(result.answer, /Enterprise overage/)
})

test('escalates server-only tasks to app-owned Worker route', async () => {
  const result = await handleWorkerHandoff({
    input: 'Export a quarterly billing variance report from the finance warehouse and explain what changed.',
  })

  assert.equal(result.mode, 'app-owned-worker')
  assert.equal(result.handoff.route, '/api/edgekit/worker-handoff')
  assert.equal(result.handoff.envelope.version, 'edgekit.handoff.v1')
  assert.equal(result.policy.outcome, 'allowed')
  assert.equal(result.report.reportId, 'variance-2026-q2-demo')
  assert.match(result.userFacingMode, /Escalated from Local\/browser/)
})

test('does not leak secrets into bounded handoff context', async () => {
  const appState = createSampleAppState()
  const result = await handleWorkerHandoff({
    input: 'Export a quarterly billing variance report from the finance warehouse and explain what changed.',
    appState,
  })

  assert.equal(hasSecretLeak(result.handoff.envelope), false)
  assert.deepEqual(result.telemetry.find((event) => event.type === 'handoff.context_bounded').excludedSecretKeys, [
    'authToken',
    'apiKey',
    'secretNotes',
    'rawCustomerEmail',
  ])
})

test('redacts arbitrary prompt PII before creating the handoff envelope', async () => {
  const result = await handleWorkerHandoff({
    input:
      'Export a quarterly billing variance report from the finance warehouse for alice@example.com with token secret_customer_token and explain what changed.',
  })
  const serializedEnvelope = JSON.stringify(result.handoff.envelope)

  assert.equal(serializedEnvelope.includes('alice@example.com'), false)
  assert.equal(serializedEnvelope.includes('secret_customer_token'), false)
  assert.match(serializedEnvelope, /\[REDACTED:email\]/)
  assert.match(serializedEnvelope, /\[REDACTED:secret\]/)
})

test('caps prompt text before creating the handoff envelope', async () => {
  const result = await handleWorkerHandoff({
    input: `Export a quarterly billing variance report from the finance warehouse. ${'extra context '.repeat(80)}`,
  })

  assert.ok(result.handoff.envelope.input.length <= 280)
  assert.match(result.handoff.envelope.input, /\[TRUNCATED\]$/)
  assert.equal(result.handoff.envelope.messages[0].content, result.handoff.envelope.input)
})

test('records mode transition telemetry and policy outcome', async () => {
  const result = await handleWorkerHandoff({
    input: 'Export a quarterly billing variance report from the finance warehouse and explain what changed.',
  })
  const eventTypes = result.telemetry.map((event) => event.type)

  assert.ok(eventTypes.includes('mode.detected'))
  assert.ok(eventTypes.includes('mode.transition'))
  assert.ok(eventTypes.includes('tool.outcome'))
  assert.ok(eventTypes.includes('server_route.completed'))
  assert.equal(result.auditEntries.length, 2)
})

test('runDemo returns mission profile and both local plus worker paths', async () => {
  const demo = await runDemo()

  assert.equal(demo.missionProfile.id, 'worker-handoff-v1')
  assert.equal(demo.localResult.mode, 'local-browser')
  assert.equal(demo.handoffResult.mode, 'app-owned-worker')
})

let passed = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    console.error(error)
    process.exit(1)
  }
}

console.log(`worker-handoff demo local tests passed (${passed}/${tests.length})`)
