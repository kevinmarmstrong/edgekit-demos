const route = '/api/edgekit/admin-workflow'
const state = { localStep: null, proposal: null, approval: null, telemetry: [], auditEntries: [] }
const $ = (selector) => document.querySelector(selector)
const write = (selector, value) => { $(selector).textContent = JSON.stringify(value, null, 2) }

function localModelRun(toolName, args, result) {
  return { provider: 'deterministic-local-browser-model', capability: 'tool-calling-local-browser-harness', toolCalls: [{ name: toolName, args }], result }
}

function redactVisible(value) {
  const text = JSON.stringify(value)
  return JSON.parse(text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED:email]').replace(/secret_[a-z_]+/gi, '[REDACTED:secret]'))
}

async function loadCascade() {
  const response = await fetch(`${route}/cascade`)
  const viewModel = await response.json()
  write('#rbac-output', redactVisible(viewModel))
  $('#local-output').textContent = JSON.stringify(localModelRun('searchAccounts', { query: 'Northstar' }, viewModel.localTool), null, 2)
}

async function runSearch() {
  const response = await fetch(`${route}/cascade`)
  const viewModel = await response.json()
  state.localStep = { mode: 'local-browser', toolName: 'searchAccounts', completed: true }
  state.search = viewModel.localTool
  state.telemetry.push({ type: 'local_tool.outcome', toolName: 'searchAccounts', mode: 'local-browser', resultCount: viewModel.localTool.results.length })
  write('#rbac-output', redactVisible(viewModel.localTool))
  write('#telemetry-output', state.telemetry)
  write('#local-output', localModelRun('searchAccounts', { query: 'Northstar' }, viewModel.localTool))
}

function runEvaluate() {
  if (!state.search) return runSearch().then(runEvaluate)
  state.proposal = { id: 'proposal-acct-northstar-plan_change', accountId: 'acct-northstar', change: { type: 'plan_change', toPlan: 'Enterprise' }, rbac: { actorRole: 'security-admin', hasPermission: true }, risk: 'high', approvalRequired: true, executable: true, requiredPermission: 'accounts:plan:update' }
  state.telemetry.push({ type: 'policy.evaluated', mode: 'local-browser', accountId: 'acct-northstar', approvalRequired: true, executable: true })
  write('#rbac-output', state.proposal)
  write('#telemetry-output', state.telemetry)
  write('#local-output', localModelRun('evaluateAdminChange', { accountId: 'acct-northstar', change: state.proposal.change }, state.proposal))
}

function runApproval() {
  if (!state.proposal) runEvaluate()
  state.approval = { id: 'approval-proposal-acct-northstar-plan_change', proposalId: state.proposal.id, status: 'approved', approver: 'vp-security', reason: 'risky-admin-change' }
  state.telemetry.push({ type: 'approval.requested', mode: 'local-browser', approvalId: state.approval.id, status: 'approved' })
  state.auditEntries.push({ action: 'approval-requested', approvalId: state.approval.id, status: 'approved' })
  write('#approval-output', state.approval)
  write('#audit-output', state.auditEntries)
  write('#telemetry-output', state.telemetry)
  write('#local-output', localModelRun('requestAdminApproval', { proposalId: state.proposal.id }, state.approval))
}

async function runMutation() {
  if (!state.approval) runApproval()
  const response = await fetch(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-edgekit-app-authority': 'admin-workflow-demo' },
    body: JSON.stringify({ input: 'Find Northstar, evaluate a Business to Enterprise plan change, ask for approval, then execute only if approved.', localStep: state.localStep, approval: state.approval }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(JSON.stringify(result))
  write('#server-output', redactVisible(result))
  write('#telemetry-output', result.telemetry)
  write('#audit-output', result.auditEntries)
  write('#local-output', localModelRun('executeApprovedAdminChange', { approvalId: state.approval.id }, result.mutation))
}

$('#run-search').addEventListener('click', () => runSearch().catch((error) => { $('#server-output').textContent = error.message }))
$('#run-evaluate').addEventListener('click', () => { try { runEvaluate() } catch (error) { $('#server-output').textContent = error.message } })
$('#run-approval').addEventListener('click', () => { try { runApproval() } catch (error) { $('#server-output').textContent = error.message } })
$('#run-mutation').addEventListener('click', () => runMutation().catch((error) => { $('#server-output').textContent = error.message }))
loadCascade().catch((error) => { $('#server-output').textContent = error.message })
