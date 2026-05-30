import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_WORKFLOW_ROUTE,
  createAdminWorkflowServer,
  createBrowserCascadeViewModel,
  createSampleAdminState,
  evaluateAdminChange,
  hasSecretLeak,
  runAdminWorkflow,
  searchAccounts,
} from './admin-workflow-demo.mjs'

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

test('searches account records with sanitized role and policy context', () => {
  const telemetry = []
  const result = searchAccounts({ query: 'Northstar', telemetry })
  assert.equal(result.toolName, 'searchAccounts')
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0].company, 'Northstar Labs')
  assert.equal(hasSecretLeak(result), false)
  assert.equal(telemetry[0].type, 'tool.call')
})

test('evaluates RBAC and marks risky admin changes approval-required', () => {
  const proposal = evaluateAdminChange()
  assert.equal(proposal.requiredPermission, 'accounts:plan:update')
  assert.equal(proposal.rbac.hasPermission, true)
  assert.equal(proposal.approvalRequired, true)
  assert.equal(proposal.executable, true)
  assert.match(proposal.recommendation, /Request approval/)
})

test('blocks mutation before approval', async () => {
  const result = await runAdminWorkflow({ approved: false })
  assert.equal(result.mode, 'approval-gated')
  assert.equal(result.mutation, null)
  assert.match(result.blockedReason, /approval required/)
  assert.equal(result.telemetry.some((event) => event.type === 'mutation.blocked'), true)
})

test('executes approved mutation through app-owned tool and records audit plus telemetry', async () => {
  const state = createSampleAdminState()
  const result = await runAdminWorkflow({ approved: true, appState: state })
  assert.equal(result.mode, 'app-owned-mutation')
  assert.equal(result.mutation.policyOutcome, 'allowed')
  assert.equal(result.mutation.accountAfter.plan, 'Enterprise')
  assert.equal(result.auditEntries.length, 3)
  assert.equal(result.telemetry.some((event) => event.type === 'server_route.completed'), true)
  assert.equal(hasSecretLeak(result), false)
})

test('legal hold suspensions are not executable under RBAC policy', () => {
  const proposal = evaluateAdminChange({ accountId: 'acct-riverbend', change: { type: 'suspension' } })
  assert.equal(proposal.rbac.legalHoldBlocked, true)
  assert.equal(proposal.executable, false)
  assert.match(proposal.recommendation, /Do not execute/)
})

test('browser cascade view model exposes required governed surfaces in order', () => {
  const viewModel = createBrowserCascadeViewModel()
  const stepIds = viewModel.cascadeSteps.map((step) => step.id)
  assert.equal(stepIds.indexOf('local-browser-search-tool') < stepIds.indexOf('approval-gate'), true)
  assert.equal(stepIds.indexOf('approval-gate') < stepIds.indexOf('app-owned-mutation-tool'), true)
  assert.equal(viewModel.serverAuthority.route, ADMIN_WORKFLOW_ROUTE)
  assert.match(viewModel.productLawNotice, /Basic\/search-only fallback is not counted as success/)
})

test('browser assets expose visible RBAC, approval, audit, and telemetry surfaces', () => {
  const index = fs.readFileSync(path.join(demoRoot, 'public/index.html'), 'utf8')
  const browserScript = fs.readFileSync(path.join(demoRoot, 'public/browser-app.js'), 'utf8')
  for (const phrase of ['data-testid="rbac-panel"', 'data-testid="approval-panel"', 'data-testid="audit-panel"', 'data-testid="telemetry-panel"']) assert.match(index, new RegExp(phrase))
  for (const phrase of ['deterministic-local-browser-model', 'tool-calling-local-browser-harness', 'searchAccounts', 'evaluateAdminChange', 'requestAdminApproval', 'executeApprovedAdminChange', 'x-edgekit-app-authority']) assert.match(browserScript, new RegExp(phrase))
})

async function withServer(fn) {
  const server = createAdminWorkflowServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

test('app-owned route rejects missing authority or missing approval', async () => {
  await withServer(async (baseUrl) => {
    const noAuthority = await fetch(`${baseUrl}${ADMIN_WORKFLOW_ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'plan change' }),
    })
    assert.equal(noAuthority.status, 403)
    const noApproval = await fetch(`${baseUrl}${ADMIN_WORKFLOW_ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-edgekit-app-authority': 'admin-workflow-demo' },
      body: JSON.stringify({
        input: 'plan change',
        localStep: { mode: 'local-browser', toolName: 'searchAccounts', completed: true },
        approval: { status: 'pending' },
      }),
    })
    assert.equal(noApproval.status, 409)
  })
})

test('app-owned route executes only after local proof and approval', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}${ADMIN_WORKFLOW_ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-edgekit-app-authority': 'admin-workflow-demo' },
      body: JSON.stringify({
        input: 'Find Northstar and upgrade plan after approval.',
        localStep: { mode: 'local-browser', toolName: 'searchAccounts', completed: true },
        approval: { status: 'approved', approver: 'vp-security' },
      }),
    })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.mutation.accountAfter.plan, 'Enterprise')
    assert.equal(body.auditEntries.length, 3)
    assert.equal(hasSecretLeak(body), false)
  })
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
console.log(`admin-workflow demo local tests passed (${passed}/${tests.length})`)
