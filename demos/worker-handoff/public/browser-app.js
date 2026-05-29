const route = '/api/edgekit/worker-handoff'
const cascadeRoute = `${route}/cascade`

const state = {
  cascade: null,
  localStep: null,
}

const $ = (selector) => document.querySelector(selector)

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

function summarizeVisibleDashboard(cascade) {
  const visibleState = cascade.localTool.visibleState
  const output = `Visible dashboard has ${visibleState.visibleAlerts.length} alerts: ${visibleState.visibleAlerts
    .map((alert) => alert.title)
    .join('; ')}.`
  return {
    mode: 'local-browser',
    toolName: 'summarizeVisibleDashboard',
    completed: true,
    boundary: 'visible host-app state only',
    userVisibleProof: 'Browser-local tool-use completed before Worker handoff.',
    output,
    visibleState,
    telemetry: {
      type: 'local_tool.outcome',
      mode: 'local-browser',
      toolName: 'summarizeVisibleDashboard',
      alertCount: visibleState.visibleAlerts.length,
    },
  }
}

function renderCascade(cascade) {
  $('#local-mode-copy').textContent = cascade.productLawNotice
  $('#local-output').textContent = pretty({
    cascadeSteps: cascade.cascadeSteps,
    localTool: cascade.localTool,
  })
  $('#handoff-output').textContent = pretty({
    route: cascade.serverAuthority.route,
    requiredAuthority: `${cascade.serverAuthority.header}: ${cascade.serverAuthority.value}`,
    localProofRequired: true,
    excludes: cascade.cascadeSteps.find((step) => step.id === 'bounded-handoff-review').excludes,
  })
}

async function loadCascade() {
  const response = await fetch(cascadeRoute)
  if (!response.ok) throw new Error(`cascade state failed: ${response.status}`)
  state.cascade = await response.json()
  renderCascade(state.cascade)
}

$('#run-local').addEventListener('click', () => {
  state.localStep = summarizeVisibleDashboard(state.cascade)
  $('#local-output').textContent = pretty(state.localStep)
})

$('#run-handoff').addEventListener('click', async () => {
  if (!state.localStep) {
    state.localStep = summarizeVisibleDashboard(state.cascade)
    $('#local-output').textContent = pretty(state.localStep)
  }

  $('#server-mode-copy').textContent = 'Local/browser proof complete; requesting explicit app-owned Worker authority.'
  const response = await fetch(route, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-edgekit-app-authority': 'worker-handoff-demo',
    },
    body: JSON.stringify({
      input:
        'Export a quarterly billing variance report from the finance warehouse for alice@example.com with token secret_customer_token.',
      localStep: {
        mode: state.localStep.mode,
        toolName: state.localStep.toolName,
        completed: state.localStep.completed,
      },
    }),
  })
  const body = await response.json()
  if (!response.ok) {
    $('#server-mode-copy').textContent = 'Server route refused execution.'
    $('#server-output').textContent = pretty(body)
    return
  }

  $('#handoff-output').textContent = pretty(body.handoffReview)
  $('#server-mode-copy').textContent = body.userFacingMode
  $('#server-output').textContent = pretty({
    report: body.report,
    policy: body.policy,
    telemetry: body.telemetry,
    auditEntries: body.auditEntries,
  })
})

loadCascade().catch((error) => {
  $('#local-mode-copy').textContent = `Failed to load browser cascade proof: ${error.message}`
})
