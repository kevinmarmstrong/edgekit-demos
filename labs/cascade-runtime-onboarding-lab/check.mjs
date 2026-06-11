import assert from 'node:assert/strict'
import {
  EDGEKIT_PACKAGE_VERSIONS,
  FRICTION_CLASSIFICATIONS,
  LAB_SCENARIOS,
  createCascadeRuntimeOnboardingLab,
} from './src/runtime-onboarding.js'

const fixedNow = () => '2026-05-29T18:00:00.000Z'

function assertIncludes(haystack, needle, label) {
  assert.ok(String(haystack).includes(needle), `${label} should include ${needle}`)
}

async function checkBrowserLocalDetection() {
  const lab = createCascadeRuntimeOnboardingLab({
    scenario: LAB_SCENARIOS.browserReady,
    now: fixedNow,
    detectBrowserModel: () => ({
      available: true,
      source: 'LanguageModel API',
      message: 'Detected browser local model.',
    }),
  })
  const snapshot = await lab.firstVisit()
  assert.equal(snapshot.mode, 'local-ready')
  assert.equal(snapshot.canRunAgent, true)
  assert.equal(lab.selectedMode, 'browser-local')
  assert.equal(snapshot.recommendedAction.provider, 'browser-local')
  assert.ok(!lab.renderViewModel(snapshot).basicFallbackActive)
  assert.ok(lab.telemetry.some((event) => event.data?.event === 'mode-transition'))
  assert.ok(lab.auditEntries.length >= 1)
}

async function checkWebLLMDownloadPath() {
  const lab = createCascadeRuntimeOnboardingLab({
    scenario: LAB_SCENARIOS.webLLMDownload,
    now: fixedNow,
  })
  const first = await lab.firstVisit()
  assert.equal(first.mode, 'downloadable')
  assert.equal(first.recommendedAction.type, 'prompt')
  assert.equal(first.recommendedAction.provider, 'webllm')
  assert.ok(lab.prompts.length >= 1)
  assertIncludes(first.recommendedAction.message, 'Download', 'WebLLM prompt')

  const downloaded = await lab.requestWebLLMDownload()
  assert.equal(downloaded.mode, 'local-ready')
  assert.equal(downloaded.canRunAgent, true)
  assert.equal(downloaded.recommendedAction.provider, 'webllm')
  assert.ok(lab.telemetry.some((event) => event.data?.status === 'downloading'))
  assert.ok(lab.transitions.some((event) => event.reason === 'user-approved-webllm-download'))
}

async function checkCloudRouteFallback() {
  const lab = createCascadeRuntimeOnboardingLab({
    scenario: LAB_SCENARIOS.cloudConfigured,
    now: fixedNow,
  })
  const snapshot = await lab.firstVisit({ preferCloud: true })
  assert.equal(snapshot.canRunAgent, true)
  assert.equal(snapshot.recommendedAction.provider, 'cloud-route')
  assert.ok(snapshot.capabilities.includes('cloud-route'))
  assert.equal(lab.selectedMode, 'cloud-route')
  const view = lab.renderViewModel(snapshot)
  assertIncludes(view.providers[0].message, '/api/edgekit/cascade', 'cloud provider message')
}

async function checkBasicFallbackLabeling() {
  const lab = createCascadeRuntimeOnboardingLab({
    scenario: LAB_SCENARIOS.basicOnly,
    now: fixedNow,
  })
  await lab.firstVisit()
  const fallback = lab.useBasicFallback()
  const view = lab.renderViewModel(fallback)
  assert.equal(fallback.canRunAgent, false)
  assert.equal(fallback.recommendedAction.type, 'fallback')
  assert.equal(view.basicFallbackActive, true)
  assertIncludes(view.basicFallbackLabel, 'not agentic success', 'Basic fallback label')
  assertIncludes(fallback.message, 'not the product experience', 'Basic fallback message')
}

async function checkUserTriggeredRetryAndModeChange() {
  const lab = createCascadeRuntimeOnboardingLab({
    scenario: LAB_SCENARIOS.basicOnly,
    now: fixedNow,
  })
  await lab.firstVisit()
  lab.setScenario(LAB_SCENARIOS.webLLMDownload)
  const retry = await lab.retry()
  assert.equal(retry.mode, 'downloadable')
  const changed = await lab.requestWebLLMDownload()
  assert.equal(changed.mode, 'local-ready')
  assert.ok(lab.transitions.some((event) => event.reason === 'user-triggered-retry'))
  assert.ok(lab.auditEntries.length >= 3)
}

function checkPackageAndClassificationEvidence() {
  assert.equal(EDGEKIT_PACKAGE_VERSIONS['@kevinmarmstrong/edgekit'], '0.3.2')
  assert.equal(EDGEKIT_PACKAGE_VERSIONS['@kevinmarmstrong/edgekit-governance'], '0.3.2')
  for (const expected of ['app-specific integration', 'weak default', 'eval/test gap']) {
    assert.ok(FRICTION_CLASSIFICATIONS.includes(expected), `missing friction classification ${expected}`)
  }
}

await checkBrowserLocalDetection()
await checkWebLLMDownloadPath()
await checkCloudRouteFallback()
await checkBasicFallbackLabeling()
await checkUserTriggeredRetryAndModeChange()
checkPackageAndClassificationEvidence()

console.log('cascade-runtime-onboarding-lab checks passed: local detection, WebLLM download, cloud fallback, Basic fallback labeling, retry/change, telemetry/audit')
