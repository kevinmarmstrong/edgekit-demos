import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMissionProfile } from '@kevinmarmstrong/edgekit'
import { createHandoffEnvelope } from '@kevinmarmstrong/edgekit-agui'
import {
  applyRedactors,
  createAuditTrail,
  createPiiRedactor,
  createToolPolicyExecutor,
} from '@kevinmarmstrong/edgekit-governance'

const DEMO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ROOT = path.join(DEMO_ROOT, 'public')
export const APP_OWNED_WORKER_ROUTE = '/api/edgekit/worker-handoff'
const CASCADE_STATE_ROUTE = `${APP_OWNED_WORKER_ROUTE}/cascade`
const APP_AUTHORITY_HEADER = 'x-edgekit-app-authority'
const APP_AUTHORITY_VALUE = 'worker-handoff-demo'

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

function publicAlerts(appState) {
  return appState.visibleAlerts.map(({ id, severity, title }) => ({ id, severity, title }))
}

export function summarizeVisibleDashboard({ appState, telemetry = [] }) {
  const alerts = publicAlerts(appState)
  const output = `Visible dashboard has ${alerts.length} alerts: ${alerts.map((alert) => alert.title).join('; ')}.`
  const result = {
    mode: 'local-browser',
    name: 'summarizeVisibleDashboard',
    toolName: 'summarizeVisibleDashboard',
    inputBoundary: 'visible host-app dashboard state only',
    userVisibleProof: 'The local/browser step read visible host-app state before any Worker handoff.',
    output,
    visibleState: {
      workspaceId: appState.workspaceId,
      currentView: appState.currentView,
      selectedQuarter: appState.selectedQuarter,
      visibleAlerts: alerts,
    },
  }
  telemetry.push({
    type: 'local_tool.outcome',
    mode: 'local-browser',
    toolName: result.toolName,
    alertCount: alerts.length,
    boundary: result.inputBoundary,
  })
  return result
}

export function createBrowserCascadeViewModel({ appState = createSampleAppState() } = {}) {
  const localTool = summarizeVisibleDashboard({ appState, telemetry: [] })
  return {
    title: 'Worker handoff golden demo',
    productLawNotice: 'Basic/search-only fallback is not counted as success; the visible proof starts with local/browser tool-use and escalates only for app-owned server authority.',
    cascadeSteps: [
      {
        id: 'local-browser-tool-use',
        label: '1. Local/browser tool-use first',
        status: 'ready',
        mode: 'local-browser',
        userVisibleProof: localTool.userVisibleProof,
        toolName: localTool.toolName,
      },
      {
        id: 'bounded-handoff-review',
        label: '2. Review bounded handoff envelope',
        status: 'required-before-server-route',
        excludes: ['authToken', 'apiKey', 'secretNotes', 'rawCustomerEmail', 'prompt-provided PII/secrets'],
      },
      {
        id: 'app-owned-worker-route',
        label: '3. App-owned Worker/server route',
        status: 'requires-explicit-app-authority',
        mode: 'app-owned-worker',
        route: APP_OWNED_WORKER_ROUTE,
      },
    ],
    localTool,
    serverAuthority: {
      required: true,
      route: APP_OWNED_WORKER_ROUTE,
      header: APP_AUTHORITY_HEADER,
      value: APP_AUTHORITY_VALUE,
      copy: 'Server capability is app-owned: the browser must send explicit authority and local-browser proof before the route will execute the Worker tool.',
    },
    cascadeStateRoute: CASCADE_STATE_ROUTE,
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
  const localTool = summarizeVisibleDashboard({ appState, telemetry })

  return {
    mode: 'local-browser',
    userFacingMode: 'Local/browser mode: bounded to visible app state; no Worker handoff required.',
    answer: localTool.output,
    localTool,
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
    route: APP_OWNED_WORKER_ROUTE,
    outcome: 'report-generated',
    reportId: report.reportId,
  })

  return {
    mode: 'app-owned-worker',
    userFacingMode:
      'Escalated from Local/browser mode to app-owned Worker mode because the request needs server-only finance warehouse access, policy enforcement, telemetry, and audit.',
    handoff: {
      route: APP_OWNED_WORKER_ROUTE,
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
    body?.localStep?.toolName === 'summarizeVisibleDashboard' &&
    body?.localStep?.completed === true
  )
}

function handoffReviewFromResult(result) {
  const envelope = result.handoff.envelope
  const boundedContextEvent = result.telemetry.find((event) => event.type === 'handoff.context_bounded')
  return {
    envelopeId: envelope.id,
    version: envelope.version,
    input: envelope.input,
    messages: envelope.messages,
    session: envelope.session,
    tools: envelope.tools,
    approximateTokens: envelope.approximateTokens,
    redactionApplied: envelope.redaction?.applied === true,
    excludedSecretKeys: boundedContextEvent?.excludedSecretKeys ?? [],
    hasSecretLeak: hasSecretLeak(envelope),
  }
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

export function createWorkerHandoffServer({ appState = createSampleAppState() } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === CASCADE_STATE_ROUTE) {
        sendJson(response, 200, createBrowserCascadeViewModel({ appState }))
        return
      }
      if (request.method === 'POST' && url.pathname === APP_OWNED_WORKER_ROUTE) {
        const body = await parseJsonRequest(request)
        if (!hasExplicitAppAuthority(request, body)) {
          sendJson(response, 403, {
            error: 'app-owned-authority-required',
            required:
              'The app-owned Worker route requires x-edgekit-app-authority plus completed local-browser tool proof before server execution.',
          })
          return
        }
        if (typeof body.input !== 'string' || body.input.trim().length === 0) {
          sendJson(response, 400, { error: 'input-required' })
          return
        }
        const result = await handleWorkerHandoff({ input: body.input, appState })
        if (result.mode !== 'app-owned-worker') {
          sendJson(response, 409, {
            error: 'server-capability-not-required',
            requiredMode: result.mode,
            userFacingMode: result.userFacingMode,
          })
          return
        }
        sendJson(response, 200, {
          route: APP_OWNED_WORKER_ROUTE,
          mode: result.mode,
          userFacingMode: result.userFacingMode,
          handoffReview: handoffReviewFromResult(result),
          policy: result.policy,
          report: result.report,
          telemetry: [
            {
              type: 'local_tool.proof_received',
              mode: 'local-browser',
              toolName: body.localStep.toolName,
              completed: true,
            },
            ...result.telemetry,
          ],
          auditEntries: result.auditEntries,
        })
        return
      }
      if (request.method === 'GET' && ['/', '/browser-app.js'].includes(url.pathname)) {
        await servePublicAsset(url.pathname, response)
        return
      }
      sendJson(response, 404, { error: 'not-found' })
    } catch (error) {
      sendJson(response, 500, { error: 'worker-handoff-server-error', message: error.message })
    }
  })
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
  if (process.argv.includes('--serve')) {
    const port = Number(process.env.PORT ?? 4173)
    const server = createWorkerHandoffServer()
    server.listen(port, '127.0.0.1', () => {
      console.log(`worker-handoff browser demo listening on http://127.0.0.1:${port}/`)
    })
  } else {
    const result = await runDemo()
    console.log(JSON.stringify(result, null, 2))
  }
}
