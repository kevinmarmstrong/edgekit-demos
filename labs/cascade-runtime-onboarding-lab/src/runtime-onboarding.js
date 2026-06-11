import {
  createCascadeReadinessController,
  createModelProvider,
} from '@kevinmarmstrong/edgekit'
import { createAuditTrail } from '@kevinmarmstrong/edgekit-governance'

export const EDGEKIT_PACKAGE_VERSIONS = Object.freeze({
  '@kevinmarmstrong/edgekit': '0.3.2',
  '@kevinmarmstrong/edgekit-governance': '0.3.2',
})

export const FRICTION_CLASSIFICATIONS = Object.freeze([
  'app-specific integration',
  'docs/onboarding gap',
  'missing primitive',
  'weak default',
  'core bug',
  'eval/test gap',
])

export const LAB_SCENARIOS = Object.freeze({
  browserReady: {
    id: 'browserReady',
    label: 'Browser local model already available',
    browserLocal: 'ready',
    webLLM: 'disabled',
    cloudRouteUrl: '',
  },
  webLLMDownload: {
    id: 'webLLMDownload',
    label: 'No browser model; WebLLM can be downloaded',
    browserLocal: 'unavailable',
    webLLM: 'downloadable',
    cloudRouteUrl: '',
  },
  cloudConfigured: {
    id: 'cloudConfigured',
    label: 'Local unavailable; app-owned cloud route configured',
    browserLocal: 'unavailable',
    webLLM: 'disabled',
    cloudRouteUrl: '/api/edgekit/cascade',
  },
  basicOnly: {
    id: 'basicOnly',
    label: 'No local or cloud model; Basic fallback only',
    browserLocal: 'unavailable',
    webLLM: 'disabled',
    cloudRouteUrl: '',
  },
})

const DEFAULT_TOOLS = Object.freeze({
  readRuntimePolicy: {
    owner: 'host-app',
    description: 'Reads host-owned runtime policy and user capability settings.',
  },
  requestCapabilityChange: {
    owner: 'host-app',
    description: 'Records a user-triggered runtime mode change request.',
  },
  openAuditTrail: {
    owner: 'host-app',
    description: 'Shows the app-owned telemetry and audit trail for mode transitions.',
  },
})

function fakeLanguageModel(provider, modelId) {
  return {
    specificationVersion: 'v3',
    provider,
    modelId,
    doGenerate: async () => ({
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      content: [],
      warnings: [],
    }),
    doStream: async () => ({
      stream: new ReadableStream(),
      warnings: [],
    }),
  }
}

function createId(prefix = 'evt') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function toIso(now) {
  const value = now()
  return value instanceof Date ? value.toISOString() : String(value)
}

function normalizeScenario(scenario = LAB_SCENARIOS.webLLMDownload) {
  if (typeof scenario === 'string') return { ...LAB_SCENARIOS[scenario] }
  return {
    ...LAB_SCENARIOS.webLLMDownload,
    ...scenario,
  }
}

export function detectBrowserLocalModel(environment = globalThis) {
  const languageModel = environment?.LanguageModel
  if (languageModel?.availability) {
    return {
      available: true,
      source: 'LanguageModel API',
      message: 'Detected the browser LanguageModel API. The app can attempt a browser-local agent runtime.',
    }
  }

  const aiNamespace = environment?.ai ?? environment?.navigator?.ai
  if (aiNamespace?.languageModel) {
    return {
      available: true,
      source: 'ai.languageModel',
      message: 'Detected an ai.languageModel runtime exposed by the browser.',
    }
  }

  return {
    available: false,
    source: 'none',
    message: 'No browser-local language model API was detected in this environment.',
  }
}

export function createCascadeRuntimeOnboardingLab(options = {}) {
  const now = options.now ?? (() => new Date())
  const sessionId = options.sessionId ?? createId('session')
  let scenario = normalizeScenario(options.scenario)
  let selectedMode = 'detect'
  let webLLMDownloaded = scenario.webLLM === 'ready'
  let lastSnapshot = null
  const telemetry = []
  const prompts = []
  const transitions = []
  const auditTrail = createAuditTrail({ sessionId, now: () => toIso(now) })

  const recordTelemetry = (name, data = {}) => {
    const event = {
      id: createId('telemetry'),
      sessionId,
      timestamp: toIso(now),
      name,
      provider: data.provider,
      status: data.status,
      data,
    }
    telemetry.push(event)
    return event
  }

  const recordAudit = (reason, snapshot, extra = {}) => {
    return auditTrail.record({
      action: 'ui-action',
      sessionId,
      reason,
      output: {
        from: extra.from,
        to: extra.to ?? selectedMode,
        mode: snapshot?.mode,
        provider: snapshot?.recommendedAction?.provider,
        recommendedAction: snapshot?.recommendedAction?.type,
        canRunAgent: snapshot?.canRunAgent,
        canUseFallback: snapshot?.canUseFallback,
        hostAuthority: 'Host app owns identity, state, policy, tools, telemetry, and audit.',
      },
    })
  }

  const transition = (to, reason, snapshot) => {
    const from = selectedMode
    selectedMode = to
    const event = recordTelemetry('ui-action', {
      event: 'mode-transition',
      from,
      to,
      reason,
      snapshotMode: snapshot?.mode,
      provider: snapshot?.recommendedAction?.provider,
    })
    transitions.push(event.data)
    recordAudit(reason, snapshot, { from, to })
    return event
  }

  const statusSink = (event) => {
    recordTelemetry('status', {
      event: 'provider-status',
      provider: event.provider,
      status: event.status,
      progress: event.progress,
      message: event.message,
    })
  }

  const createBrowserLocalProvider = () => createModelProvider({
    id: 'browser-local',
    label: 'Browser local model',
    resolve: async (context) => {
      const detected = options.detectBrowserModel
        ? options.detectBrowserModel()
        : detectBrowserLocalModel(options.environment ?? globalThis)

      if (scenario.browserLocal === 'ready' || detected.available) {
        context.emitStatus({
          provider: 'browser-local',
          status: 'ready',
          message: `${detected.source === 'none' ? 'Configured lab scenario' : detected.source} is ready for app-level agent operation.`,
        })
        return fakeLanguageModel('browser-local', 'browser-runtime')
      }

      context.emitStatus({
        provider: 'browser-local',
        status: 'unavailable',
        message: detected.message,
      })
      return null
    },
  })

  const createWebLLMProvider = () => createModelProvider({
    id: 'webllm',
    label: 'WebLLM local download',
    resolve: async (context) => {
      if (scenario.webLLM === 'disabled') {
        context.emitStatus({
          provider: 'webllm',
          status: 'unavailable',
          message: 'WebLLM is disabled for this app policy/scenario.',
        })
        return null
      }

      if (webLLMDownloaded || scenario.webLLM === 'ready') {
        context.emitStatus({
          provider: 'webllm',
          status: 'ready',
          message: 'WebLLM assets are present; local runtime can operate app-owned tools.',
        })
        return fakeLanguageModel('webllm', 'Llama-3.2-1B-Instruct-q4f16_1-MLC')
      }

      const allowed = await context.requestDownload({
        provider: 'webllm',
        modelSize: '~750 MB',
        message: 'Download a local WebLLM model to keep the governed agent in the browser. The host app remains the authority for state, tools, and approvals.',
      })

      if (!allowed) {
        return null
      }

      recordTelemetry('status', {
        event: 'provider-status',
        provider: 'webllm',
        status: 'downloading',
        progress: 0.4,
        message: 'Downloading WebLLM model assets with explicit user consent.',
      })
      context.emitStatus({
        provider: 'webllm',
        status: 'downloading',
        progress: 0.4,
        message: 'Downloading WebLLM model assets with explicit user consent.',
      })
      recordTelemetry('status', {
        event: 'provider-status',
        provider: 'webllm',
        status: 'downloading',
        progress: 0.8,
        message: 'Preparing local WebLLM runtime.',
      })
      context.emitStatus({
        provider: 'webllm',
        status: 'downloading',
        progress: 0.8,
        message: 'Preparing local WebLLM runtime.',
      })
      webLLMDownloaded = true
      recordTelemetry('status', {
        event: 'provider-status',
        provider: 'webllm',
        status: 'ready',
        message: 'WebLLM download complete; local agent mode is available.',
      })
      context.emitStatus({
        provider: 'webllm',
        status: 'ready',
        message: 'WebLLM download complete; local agent mode is available.',
      })
      return fakeLanguageModel('webllm', 'Llama-3.2-1B-Instruct-q4f16_1-MLC')
    },
  })

  const createCloudRouteProvider = () => createModelProvider({
    id: 'cloud-route',
    label: 'App-owned cloud/server route',
    resolve: async (context) => {
      if (!scenario.cloudRouteUrl) {
        context.emitStatus({
          provider: 'cloud-route',
          status: 'unavailable',
          message: 'No app-owned cloud/server route is configured.',
        })
        return null
      }

      context.emitStatus({
        provider: 'cloud-route',
        status: 'ready',
        message: `Cloud/server fallback is configured at ${scenario.cloudRouteUrl}. The route receives bounded context only.`,
      })
      return fakeLanguageModel('cloud-route', scenario.cloudRouteUrl)
    },
  })

  const providerSetFor = (mode) => {
    if (mode === 'browser-local') return [createBrowserLocalProvider()]
    if (mode === 'webllm') return [createWebLLMProvider()]
    if (mode === 'cloud-route') return [createCloudRouteProvider()]
    if (mode === 'basic') return []
    return [createBrowserLocalProvider(), createWebLLMProvider()]
  }

  const requiredFor = (mode) => {
    if (mode === 'cloud-route') return ['cloud-route', 'tools']
    return ['local-model', 'tools']
  }

  const evaluate = async (mode = selectedMode, optionsForCheck = {}) => {
    const controller = createCascadeReadinessController({
      providers: providerSetFor(mode),
      requiredCapabilities: requiredFor(mode),
      tools: DEFAULT_TOOLS,
      requiredTools: ['readRuntimePolicy', 'requestCapabilityChange', 'openAuditTrail'],
      approvals: true,
      edgeView: true,
      fallback: true,
      downloadPolicy: 'prompt',
      onSnapshot: (snapshot) => {
        lastSnapshot = snapshot
        recordTelemetry('status', {
          event: 'readiness-snapshot',
          mode: snapshot.mode,
          recommendedAction: snapshot.recommendedAction.type,
          provider: snapshot.recommendedAction.provider,
        })
      },
      onPrompt: (action, snapshot) => {
        prompts.push({ action, snapshot })
        recordTelemetry('ui-action', {
          event: 'download-prompt',
          provider: action.provider,
          message: action.message,
        })
      },
    })

    const snapshot = await controller.check({ allowPrompt: optionsForCheck.allowDownload === true })
    lastSnapshot = snapshot
    return snapshot
  }

  const firstVisit = async (optionsForCheck = {}) => {
    const localSnapshot = await evaluate('detect', { allowDownload: optionsForCheck.allowDownload })
    if (localSnapshot.canRunAgent) {
      transition(localSnapshot.recommendedAction.provider === 'webllm' ? 'webllm' : 'browser-local', 'first-visit-ready', localSnapshot)
      return localSnapshot
    }

    if (localSnapshot.mode === 'downloadable' && !optionsForCheck.preferCloud) {
      transition('webllm', 'first-visit-webllm-downloadable', localSnapshot)
      return localSnapshot
    }

    if (scenario.cloudRouteUrl) {
      const cloudSnapshot = await evaluate('cloud-route')
      transition('cloud-route', 'first-visit-cloud-route-configured', cloudSnapshot)
      return cloudSnapshot
    }

    transition('basic', 'first-visit-basic-fallback-only', localSnapshot)
    return localSnapshot
  }

  return {
    sessionId,
    packageVersions: EDGEKIT_PACKAGE_VERSIONS,
    tools: DEFAULT_TOOLS,
    get scenario() {
      return { ...scenario }
    },
    get selectedMode() {
      return selectedMode
    },
    get lastSnapshot() {
      return lastSnapshot
    },
    get telemetry() {
      return [...telemetry]
    },
    get prompts() {
      return [...prompts]
    },
    get transitions() {
      return [...transitions]
    },
    get auditEntries() {
      return auditTrail.entries ? auditTrail.entries() : []
    },
    setScenario(nextScenario) {
      scenario = normalizeScenario(nextScenario)
      webLLMDownloaded = scenario.webLLM === 'ready'
      recordTelemetry('ui-action', { event: 'scenario-change', scenario: scenario.id })
      return { ...scenario }
    },
    firstVisit,
    async retry(optionsForCheck = {}) {
      const snapshot = await firstVisit(optionsForCheck)
      transition(selectedMode, 'user-triggered-retry', snapshot)
      return snapshot
    },
    async chooseMode(mode, optionsForCheck = {}) {
      const snapshot = mode === 'basic'
        ? await evaluate('basic')
        : await evaluate(mode, optionsForCheck)
      transition(mode, `user-selected-${mode}`, snapshot)
      return snapshot
    },
    async requestWebLLMDownload() {
      const snapshot = await evaluate('webllm', { allowDownload: true })
      transition('webllm', 'user-approved-webllm-download', snapshot)
      return snapshot
    },
    useBasicFallback() {
      const from = selectedMode
      selectedMode = 'basic'
      const snapshot = {
        mode: 'fallback-ready',
        message: 'Basic fallback is available for non-agentic guidance only. It is not the product experience.',
        providers: [],
        capabilities: ['no-model-fallback', 'tools', 'approvals', 'edgeview'],
        requiredCapabilities: ['local-model', 'tools'],
        missingCapabilities: ['local-model'],
        recommendedAction: {
          type: 'fallback',
          label: 'Use Basic fallback',
          message: 'Basic fallback can explain setup and retry options, but cannot operate as the governed app-level agent.',
        },
        canRunAgent: false,
        canUseFallback: true,
        shouldHideFeatures: false,
        downloadPolicy: 'prompt',
        updatedAt: toIso(now),
      }
      lastSnapshot = snapshot
      const event = recordTelemetry('ui-action', {
        event: 'mode-transition',
        from,
        to: 'basic',
        reason: 'user-selected-basic-fallback',
        snapshotMode: snapshot.mode,
      })
      transitions.push(event.data)
      recordAudit('user-selected-basic-fallback', snapshot, { from, to: 'basic' })
      return snapshot
    },
    renderViewModel(snapshot = lastSnapshot) {
      const providerSummary = snapshot?.providers?.map((provider) => ({
        id: provider.id,
        label: provider.label,
        status: provider.status,
        progress: provider.progress ?? null,
        message: provider.id === 'cloud-route' && scenario.cloudRouteUrl
          ? `${provider.message ?? 'Cloud/server route is ready.'} Configured route: ${scenario.cloudRouteUrl}. Bounded context only.`
          : provider.message ?? '',
      })) ?? []
      const isBasic = selectedMode === 'basic' || snapshot?.recommendedAction?.type === 'fallback'
      return {
        title: 'Cascade Runtime Onboarding Lab',
        selectedMode,
        primaryLabel: snapshot?.recommendedAction?.label ?? 'Check runtime',
        primaryMessage: snapshot?.recommendedAction?.message ?? 'Check browser and app-owned runtime capability.',
        basicFallbackLabel: 'Basic fallback — setup guidance only, not agentic success',
        basicFallbackActive: isBasic,
        canRunAgent: snapshot?.canRunAgent === true,
        providers: providerSummary,
        hostAuthority: 'Host app owns identity, state, app tools, approvals, telemetry, and audit. Edgekit exposes runtime readiness; it does not own app authority.',
        auditCount: auditTrail.entries ? auditTrail.entries().length : 0,
        telemetryCount: telemetry.length,
      }
    },
  }
}

export async function mountCascadeRuntimeOnboardingLab(root, options = {}) {
  if (!root) throw new Error('mountCascadeRuntimeOnboardingLab requires a root element')
  const lab = createCascadeRuntimeOnboardingLab(options)

  const render = (snapshot = lab.lastSnapshot) => {
    const view = lab.renderViewModel(snapshot)
    root.innerHTML = `
      <section class="lab-shell" aria-label="Cascade runtime onboarding lab">
        <header>
          <p class="eyebrow">Runtime/capability onboarding for a governed app-level agent user</p>
          <h1>${view.title}</h1>
          <p>${view.hostAuthority}</p>
        </header>
        <div class="status-card" data-mode="${view.selectedMode}">
          <h2>${view.primaryLabel}</h2>
          <p>${view.primaryMessage}</p>
          <p class="fallback-label">${view.basicFallbackLabel}</p>
          <p><strong>Can run governed agent:</strong> ${view.canRunAgent ? 'yes' : 'no'}</p>
        </div>
        <div class="controls" aria-label="Mode controls">
          <button data-action="first-visit">Run first-visit detection</button>
          <button data-action="download">Download WebLLM</button>
          <button data-action="cloud">Use cloud/server route</button>
          <button data-action="basic">Use Basic fallback</button>
          <button data-action="retry">Retry/change mode</button>
        </div>
        <h2>Provider readiness</h2>
        <ul>${view.providers.map((provider) => `<li><strong>${provider.label}</strong>: ${provider.status}${provider.progress ? ` (${Math.round(provider.progress * 100)}%)` : ''}<br>${provider.message}</li>`).join('')}</ul>
        <h2>Telemetry and audit</h2>
        <p>${view.telemetryCount} telemetry events; ${view.auditCount} audit entries.</p>
      </section>
    `

    root.querySelector('[data-action="first-visit"]')?.addEventListener('click', async () => render(await lab.firstVisit()))
    root.querySelector('[data-action="download"]')?.addEventListener('click', async () => render(await lab.requestWebLLMDownload()))
    root.querySelector('[data-action="cloud"]')?.addEventListener('click', async () => render(await lab.chooseMode('cloud-route')))
    root.querySelector('[data-action="basic"]')?.addEventListener('click', () => render(lab.useBasicFallback()))
    root.querySelector('[data-action="retry"]')?.addEventListener('click', async () => render(await lab.retry()))
  }

  render(await lab.firstVisit())
  return lab
}
