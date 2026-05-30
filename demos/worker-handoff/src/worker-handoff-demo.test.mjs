import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APP_OWNED_WORKER_ROUTE,
  createBrowserCascadeViewModel,
  createSampleAppState,
  createWorkerHandoffServer,
  handleWorkerHandoff,
  hasSecretLeak,
  runDemo,
} from './worker-handoff-demo.mjs'

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

test('browser cascade view model makes local-browser tool use visible before worker escalation', () => {
  const viewModel = createBrowserCascadeViewModel({ appState: createSampleAppState() })
  const stepIds = viewModel.cascadeSteps.map((step) => step.id)

  assert.equal(viewModel.serverAuthority.route, APP_OWNED_WORKER_ROUTE)
  assert.equal(stepIds.indexOf('local-browser-tool-use') < stepIds.indexOf('app-owned-worker-route'), true)
  assert.equal(viewModel.localTool.name, 'summarizeVisibleDashboard')
  assert.match(viewModel.localTool.userVisibleProof, /visible host-app state/i)
  assert.match(viewModel.productLawNotice, /Basic\/search-only fallback is not counted as success/)
})

test('browser assets expose visible local-first cascade and app-owned route contract', () => {
  const index = fs.readFileSync(path.join(demoRoot, 'public/index.html'), 'utf8')
  const browserScript = fs.readFileSync(path.join(demoRoot, 'public/browser-app.js'), 'utf8')

  assert.match(index, /data-testid="local-browser-step"/)
  assert.match(index, /data-testid="handoff-envelope-review"/)
  assert.match(index, /data-testid="server-result"/)
  assert.match(browserScript, /summarizeVisibleDashboard/)
  assert.match(browserScript, /deterministic-local-browser-model/)
  assert.match(browserScript, /tool-calling-local-browser-harness/)
  assert.match(browserScript, /redactBrowserModelTask/)
  assert.match(browserScript, /\[REDACTED:email\]/)
  assert.match(browserScript, /\[REDACTED:secret\]/)
  assert.match(browserScript, /x-edgekit-app-authority/)
  assert.match(browserScript, new RegExp(APP_OWNED_WORKER_ROUTE))
})

async function withWorkerHandoffServer(fn) {
  const server = createWorkerHandoffServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

test('app-owned Worker route rejects handoff without explicit app authority and local proof', async () => {
  await withWorkerHandoffServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}${APP_OWNED_WORKER_ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'Export a quarterly billing variance report from the finance warehouse.' }),
    })
    const body = await response.json()

    assert.equal(response.status, 403)
    assert.equal(body.error, 'app-owned-authority-required')
    assert.match(body.required, /local-browser tool proof/)
  })
})

test('app-owned Worker route returns sanitized envelope, telemetry, and audit after local browser proof', async () => {
  await withWorkerHandoffServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}${APP_OWNED_WORKER_ROUTE}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-edgekit-app-authority': 'worker-handoff-demo',
      },
      body: JSON.stringify({
        input:
          'Export a quarterly billing variance report from the finance warehouse for alice@example.com with token secret_customer_token.',
        localStep: {
          mode: 'local-browser',
          toolName: 'summarizeVisibleDashboard',
          completed: true,
        },
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.route, APP_OWNED_WORKER_ROUTE)
    assert.equal(body.handoffReview.redactionApplied, true)
    assert.deepEqual(body.handoffReview.excludedSecretKeys, ['authToken', 'apiKey', 'secretNotes', 'rawCustomerEmail'])
    assert.equal(JSON.stringify(body).includes('alice@example.com'), false)
    assert.equal(JSON.stringify(body).includes('secret_customer_token'), false)
    assert.ok(body.telemetry.map((event) => event.type).includes('mode.transition'))
    assert.equal(body.auditEntries.length, 2)
  })
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
