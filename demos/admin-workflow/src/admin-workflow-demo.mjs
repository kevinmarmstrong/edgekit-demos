import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMissionProfile } from '@kevinmarmstrong/edgekit'
import { createAuditTrail, createToolPolicyExecutor } from '@kevinmarmstrong/edgekit-governance'

const DEMO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ROOT = path.join(DEMO_ROOT, 'public')
export const ADMIN_WORKFLOW_ROUTE = '/api/edgekit/admin-workflow'
const CASCADE_STATE_ROUTE = `${ADMIN_WORKFLOW_ROUTE}/cascade`
const APP_AUTHORITY_HEADER = 'x-edgekit-app-authority'
const APP_AUTHORITY_VALUE = 'admin-workflow-demo'

export function createAdminWorkflowMissionProfile() {
  return createMissionProfile({
    id: 'enterprise-admin-workflow-v1',
    mission: 'admin-workflow',
    version: '1.0.0',
    systemPrompt:
      'Act as a governed enterprise admin user. Search app-owned account state first, evaluate RBAC and risk, require approval for risky changes, execute only through approved app-owned mutation tools, and record audit plus telemetry.',
    requiredTools: ['searchAccounts', 'evaluateAdminChange', 'requestAdminApproval', 'executeApprovedAdminChange'],
    defaults: { toolChoice: 'required', downloadPolicy: 'never' },
  })
}

export function createSampleAdminState() {
  return {
    tenantId: 'enterprise-admin-demo',
    actingAdmin: {
      id: 'admin-sam',
      name: 'Sam Rivera',
      role: 'security-admin',
      permissions: ['accounts:read', 'accounts:plan:update', 'accounts:suspend', 'roles:grant:limited'],
    },
    accounts: [
      {
        id: 'acct-northstar',
        company: 'Northstar Labs',
        plan: 'Business',
        status: 'active',
        seats: 240,
        policyTags: ['regulated-data', 'sso-required'],
        roles: ['billing-admin'],
        visibleRisk: 'Invoice failures and unmanaged privileged user detected.',
        ownerEmail: 'northstar-owner@example.com',
        internalRiskNotes: 'secret_escalation_note_should_not_render',
      },
      {
        id: 'acct-riverbend',
        company: 'Riverbend Health',
        plan: 'Enterprise',
        status: 'active',
        seats: 1200,
        policyTags: ['hipaa', 'legal-hold'],
        roles: ['support-admin', 'viewer'],
        visibleRisk: 'Legal hold prevents suspension without compliance approval.',
        ownerEmail: 'riverbend-owner@example.com',
        internalRiskNotes: 'secret_legal_hold_contact',
      },
    ],
  }
}

function publicAccount(account) {
  const { ownerEmail: _ownerEmail, internalRiskNotes: _internalRiskNotes, ...safe } = account
  return safe
}

export function hasSecretLeak(value) {
  const serialized = JSON.stringify(value)
  return [
    'northstar-owner@example.com',
    'riverbend-owner@example.com',
    'secret_escalation_note_should_not_render',
    'secret_legal_hold_contact',
    'ownerEmail',
    'internalRiskNotes',
  ].some((secret) => serialized.includes(secret))
}

export function searchAccounts({ query = 'northstar', appState = createSampleAdminState(), telemetry = [] } = {}) {
  const normalized = query.toLowerCase()
  const matches = appState.accounts
    .filter((account) => `${account.company} ${account.id} ${account.policyTags.join(' ')}`.toLowerCase().includes(normalized))
    .map(publicAccount)
  telemetry.push({ type: 'tool.call', mode: 'local-browser', toolName: 'searchAccounts', query, resultCount: matches.length })
  return {
    mode: 'local-browser',
    toolName: 'searchAccounts',
    inputBoundary: 'visible account list, role, and policy context only',
    userVisibleProof: 'The local/browser model searched account records before proposing a risky admin change.',
    actingAdmin: appState.actingAdmin,
    results: matches,
  }
}

export function evaluateAdminChange({
  accountId = 'acct-northstar',
  change = { type: 'plan_change', toPlan: 'Enterprise' },
  appState = createSampleAdminState(),
  telemetry = [],
} = {}) {
  const account = appState.accounts.find((candidate) => candidate.id === accountId)
  if (!account) throw new Error(`account not found: ${accountId}`)
  const permissionByChange = {
    plan_change: 'accounts:plan:update',
    suspension: 'accounts:suspend',
    role_grant: 'roles:grant:limited',
  }
  const requiredPermission = permissionByChange[change.type]
  const hasPermission = appState.actingAdmin.permissions.includes(requiredPermission)
  const risky = change.type === 'suspension' || change.type === 'role_grant' || account.policyTags.includes('regulated-data')
  const legalHoldBlocked = change.type === 'suspension' && account.policyTags.includes('legal-hold')
  const proposal = {
    id: `proposal-${account.id}-${change.type}`,
    account: publicAccount(account),
    change,
    requiredPermission,
    rbac: { actorRole: appState.actingAdmin.role, hasPermission, legalHoldBlocked },
    risk: risky ? 'high' : 'medium',
    approvalRequired: risky,
    executable: hasPermission && !legalHoldBlocked,
    recommendation: legalHoldBlocked
      ? 'Do not execute: legal hold requires compliance workflow outside this demo.'
      : `Request approval before ${change.type.replace('_', ' ')} for ${account.company}.`,
  }
  telemetry.push({
    type: 'policy.evaluated',
    mode: 'local-browser',
    accountId,
    changeType: change.type,
    requiredPermission,
    hasPermission,
    approvalRequired: proposal.approvalRequired,
    executable: proposal.executable,
  })
  return proposal
}

export function requestAdminApproval({ proposal, approved = false, approver = 'vp-security', telemetry = [], auditTrail } = {}) {
  const approval = {
    id: `approval-${proposal.id}`,
    proposalId: proposal.id,
    status: approved ? 'approved' : 'pending',
    approver,
    reason: proposal.approvalRequired ? 'risky-admin-change' : 'approval-not-required',
  }
  telemetry.push({ type: 'approval.requested', mode: 'local-browser', approvalId: approval.id, status: approval.status, proposalId: proposal.id })
  auditTrail?.record({ action: 'approval-requested', approvalId: approval.id, proposalId: proposal.id, status: approval.status })
  return approval
}

function applyApprovedChange({ proposal, appState }) {
  const account = appState.accounts.find((candidate) => candidate.id === proposal.account.id)
  if (!account) throw new Error(`account not found: ${proposal.account.id}`)
  if (proposal.change.type === 'plan_change') account.plan = proposal.change.toPlan
  if (proposal.change.type === 'suspension') account.status = 'suspended'
  if (proposal.change.type === 'role_grant') account.roles = [...new Set([...account.roles, proposal.change.role])]
  return publicAccount(account)
}

export async function executeApprovedAdminChange({ proposal, approval, appState = createSampleAdminState(), telemetry = [], auditTrail }) {
  if (!proposal.executable) throw new Error('proposal is not executable under current RBAC/policy')
  if (proposal.approvalRequired && approval?.status !== 'approved') throw new Error('approval required before mutation')
  const policyExecutor = createToolPolicyExecutor({
    defaultPolicy: {
      allowedTools: ['executeApprovedAdminChange'],
      timeoutMs: 1_000,
      maxInputBytes: 3_000,
      maxOutputBytes: 4_000,
    },
  })
  const tool = {
    async execute(input, context) {
      auditTrail.record({
        action: 'mutation-started',
        sessionId: context.sessionId,
        runId: context.runId,
        toolName: 'executeApprovedAdminChange',
        proposalId: input.proposal.id,
        approvalId: input.approval.id,
        actor: context.identity.id,
      })
      const accountAfter = applyApprovedChange({ proposal: input.proposal, appState })
      const result = { mutationId: `mutation-${input.approval.id}`, accountAfter, policyOutcome: 'allowed' }
      telemetry.push({
        type: 'mutation.executed',
        mode: 'app-owned-mutation',
        toolName: 'executeApprovedAdminChange',
        mutationId: result.mutationId,
        accountId: accountAfter.id,
      })
      auditTrail.record({ action: 'mutation-completed', sessionId: context.sessionId, runId: context.runId, toolName: 'executeApprovedAdminChange', output: result })
      return result
    },
  }
  return policyExecutor.execute({
    toolName: 'executeApprovedAdminChange',
    tool,
    input: { proposal, approval },
    context: {
      sessionId: 'admin-workflow-demo-session',
      runId: 'run-admin-workflow-001',
      identity: appState.actingAdmin,
      state: { tenantId: appState.tenantId },
    },
  })
}

export async function runAdminWorkflow({
  input = 'Find Northstar, evaluate a Business to Enterprise plan change, ask for approval, then execute only if approved.',
  approved = true,
  appState = createSampleAdminState(),
} = {}) {
  const telemetry = []
  const auditTrail = createAuditTrail({ sessionId: 'admin-workflow-demo-session' })
  const search = searchAccounts({ query: input.includes('Riverbend') ? 'Riverbend' : 'Northstar', appState, telemetry })
  const proposal = evaluateAdminChange({ accountId: search.results[0].id, change: { type: 'plan_change', toPlan: 'Enterprise' }, appState, telemetry })
  const approval = requestAdminApproval({ proposal, approved, telemetry, auditTrail })
  let mutation = null
  let blockedReason = null
  try {
    mutation = await executeApprovedAdminChange({ proposal, approval, appState, telemetry, auditTrail })
    telemetry.push({ type: 'server_route.completed', mode: 'app-owned-mutation', route: ADMIN_WORKFLOW_ROUTE, outcome: 'mutation-applied', mutationId: mutation.mutationId })
  } catch (error) {
    blockedReason = error.message
    telemetry.push({ type: 'mutation.blocked', mode: 'app-owned-mutation', reason: blockedReason })
  }
  const result = {
    missionProfile: createAdminWorkflowMissionProfile(),
    mode: mutation ? 'app-owned-mutation' : 'approval-gated',
    userFacingMode: mutation
      ? 'Local/browser search and RBAC evaluation completed; app-owned mutation executed after approval.'
      : 'Risky admin change is approval-gated; no mutation executed.',
    search,
    proposal,
    approval,
    mutation,
    blockedReason,
    telemetry,
    auditEntries: auditTrail.entries(),
  }
  if (hasSecretLeak(result)) throw new Error('admin workflow result leaked hidden account secrets')
  return result
}

export function createBrowserCascadeViewModel({ appState = createSampleAdminState() } = {}) {
  const telemetry = []
  const search = searchAccounts({ query: 'Northstar', appState, telemetry })
  return {
    title: 'Enterprise admin workflow golden demo',
    productLawNotice: 'Basic/search-only fallback is not counted as success; the proof is local/browser tool use plus approval-gated app-owned mutation.',
    cascadeSteps: [
      { id: 'local-browser-search-tool', label: '1. Search account records with role/policy context', mode: 'local-browser', status: 'ready', toolName: 'searchAccounts' },
      { id: 'rbac-policy-evaluation', label: '2. Evaluate RBAC and risky change policy', mode: 'local-browser', status: 'required-before-approval', toolName: 'evaluateAdminChange' },
      { id: 'approval-gate', label: '3. Approval gate for risky admin change', mode: 'approval', status: 'required-before-mutation', toolName: 'requestAdminApproval' },
      { id: 'app-owned-mutation-tool', label: '4. Execute only through app-owned mutation tool', mode: 'app-owned-mutation', status: 'requires-explicit-app-authority', route: ADMIN_WORKFLOW_ROUTE, toolName: 'executeApprovedAdminChange' },
    ],
    localTool: search,
    serverAuthority: { required: true, route: ADMIN_WORKFLOW_ROUTE, header: APP_AUTHORITY_HEADER, value: APP_AUTHORITY_VALUE },
    cascadeStateRoute: CASCADE_STATE_ROUTE,
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload, null, 2))
}

function sendText(response, statusCode, body, contentType) {
  response.writeHead(statusCode, { 'content-type': contentType })
  response.end(body)
}

async function parseJsonRequest(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  if (!raw.trim()) return {}
  return JSON.parse(raw)
}

function hasExplicitAppAuthority(request, body) {
  return (
    request.headers[APP_AUTHORITY_HEADER] === APP_AUTHORITY_VALUE &&
    body?.localStep?.mode === 'local-browser' &&
    body?.localStep?.toolName === 'searchAccounts' &&
    body?.localStep?.completed === true
  )
}

async function servePublicAsset(requestPath, response) {
  const assetPath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '')
  if (!['index.html', 'browser-app.js'].includes(assetPath)) {
    sendJson(response, 404, { error: 'not-found' })
    return
  }
  const body = await fs.readFile(path.join(PUBLIC_ROOT, assetPath), 'utf8')
  sendText(response, 200, body, assetPath.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
}

export function createAdminWorkflowServer({ appState = createSampleAdminState() } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === CASCADE_STATE_ROUTE) {
        sendJson(response, 200, createBrowserCascadeViewModel({ appState }))
        return
      }
      if (request.method === 'POST' && url.pathname === ADMIN_WORKFLOW_ROUTE) {
        const body = await parseJsonRequest(request)
        if (!hasExplicitAppAuthority(request, body)) {
          sendJson(response, 403, { error: 'app-owned-authority-required', required: 'x-edgekit-app-authority plus completed local-browser searchAccounts proof' })
          return
        }
        if (body?.approval?.status !== 'approved') {
          sendJson(response, 409, { error: 'approval-required', required: 'An approved approval record is required before executeApprovedAdminChange can mutate account state.' })
          return
        }
        const result = await runAdminWorkflow({ input: body.input, approved: true, appState })
        sendJson(response, 200, { route: ADMIN_WORKFLOW_ROUTE, ...result })
        return
      }
      await servePublicAsset(url.pathname, response)
    } catch (error) {
      sendJson(response, 500, { error: 'admin-workflow-server-error', message: error.message })
    }
  })
}

export async function runDemo() {
  const approved = await runAdminWorkflow({ approved: true })
  const blocked = await runAdminWorkflow({ approved: false })
  return { missionProfile: createAdminWorkflowMissionProfile(), approved, blocked }
}

if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT ?? 4175)
  createAdminWorkflowServer().listen(port, '127.0.0.1', () => {
    console.log(`admin-workflow browser demo listening on http://127.0.0.1:${port}/`)
  })
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDemo()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
