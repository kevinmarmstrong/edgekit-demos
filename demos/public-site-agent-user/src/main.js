import { mountChat } from '@kevinmarmstrong/edgekit-ui/lite'
import {
  acceptanceSnapshot,
  createPublicSiteCascadeController,
  createPublicSiteQaKit,
  handleNoModelPublicSiteAnswer,
  publicSiteModelProviders,
} from './agent-user.mjs'

const kit = createPublicSiteQaKit()
const providers = publicSiteModelProviders()
const cascade = createPublicSiteCascadeController({ providers })
const modeOutput = document.querySelector('[data-capability-mode]')
const evidenceOutput = document.querySelector('[data-evidence-summary]')
const wizard = document.querySelector('edge-cascade-wizard')

const chat = mountChat('#assistant', {
  missionProfile: kit.profile,
  tools: kit.tools,
  cascadeReadiness: cascade,
  model: providers,
  agentTitle: 'Edgekit Public Site Guide',
  agentSubtitle: 'Grounded public-site agent user',
  statusText: 'Uses browser-local cascade when available; Basic fallback is labeled.',
  placeholder: 'Ask about Edgekit, capability mode, or the configured assistant identity',
  readyMessage:
    'Ask a grounded question. Unsupported identity, location, or disambiguation claims will be refused.',
  showToolEvents: true,
  grounding: 'strict',
  toolChoice: 'required',
  onNoModel: handleNoModelPublicSiteAnswer,
  telemetry(event) {
    window.dispatchEvent(new CustomEvent('edgekit-public-site-telemetry', { detail: event }))
  },
})

chat.useCascadeReadiness(cascade)
wizard?.configure(cascade)

function renderMode(snapshot) {
  if (modeOutput) {
    modeOutput.textContent = `${snapshot.mode}: ${snapshot.message} Action: ${snapshot.recommendedAction.label} — ${snapshot.recommendedAction.message}`
  }
}

function renderEvidence() {
  const snapshot = acceptanceSnapshot()
  if (evidenceOutput) {
    evidenceOutput.textContent = `${snapshot.matchCount} grounded result(s); ${snapshot.citations.length} citation(s); required tool ${snapshot.requiredTool}; grounding ${snapshot.grounding}.`
  }
}

cascade.subscribe(renderMode)
renderMode(cascade.getSnapshot())
renderEvidence()
cascade.check({ allowPrompt: false }).catch(error => {
  if (modeOutput) modeOutput.textContent = `error: ${String(error?.message ?? error)}`
})

window.edgekitPublicSiteDemo = {
  chat,
  cascade,
  kit,
  acceptanceSnapshot,
}
