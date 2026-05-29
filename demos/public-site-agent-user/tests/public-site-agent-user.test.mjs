import assert from 'node:assert/strict'
import {
  PUBLIC_SITE_NO_EVIDENCE_MESSAGE,
  acceptanceSnapshot,
  answerFromPublicSiteFallback,
  createPublicSiteCascadeController,
  createPublicSiteQaKit,
} from '../src/agent-user.mjs'
import { searchPublicSite, tokenizeQuery } from '../src/site-content.mjs'

const kit = createPublicSiteQaKit()

assert.equal(kit.profile.grounding, 'strict')
assert.equal(kit.profile.defaults.toolChoice, 'required')
assert.equal(kit.profile.defaults.downloadPolicy, 'never')
assert.deepEqual(kit.profile.requiredTools, ['searchPublicSite'])
assert.ok(kit.tools.searchPublicSite, 'grounded QA kit exposes the app-owned read tool')
assert.match(kit.profile.systemPrompt, /Do not invent location, biography, hardware/)

const capabilityAnswer = await answerFromPublicSiteFallback('What capability mode is this site using?')
assert.match(capabilityAnswer, /^Fallback response \(no model available\):/)
assert.match(capabilityAnswer, /Capability mode and cascade/)
assert.match(capabilityAnswer, /Basic fallback/)
assert.match(capabilityAnswer, /\/#capability-mode/)

const identityAnswer = await answerFromPublicSiteFallback('Who am I chatting with?')
assert.match(identityAnswer, /Configured assistant identity/)
assert.match(identityAnswer, /Edgekit Public Site Guide/)
assert.match(identityAnswer, /configured runtime identity/)

const unsupportedAnswer = await answerFromPublicSiteFallback(
  'Are you from Ohio and building rockets with robots?',
)
assert.equal(
  unsupportedAnswer,
  `Fallback response (no model available): ${PUBLIC_SITE_NO_EVIDENCE_MESSAGE}`,
)
assert.deepEqual(searchPublicSite('Ohio rockets robots'), [])
assert.deepEqual(tokenizeQuery('what is the site?'), [])

const controller = createPublicSiteCascadeController({
  providers: [
    {
      id: 'chrome-ai',
      label: 'Chrome built-in AI test provider',
      async resolve(context) {
        context.emitStatus({
          provider: 'chrome-ai',
          status: 'ready',
          message: 'Local model ready for test.',
        })
        return { provider: 'test-local-model' }
      },
    },
  ],
  now: () => '2026-05-29T00:00:00.000Z',
})
const readySnapshot = controller.recordStatus({
  provider: 'chrome-ai',
  status: 'ready',
  message: 'Local model ready for test.',
})
assert.equal(readySnapshot.mode, 'local-ready')
assert.equal(readySnapshot.canRunAgent, true)
assert.equal(readySnapshot.canUseFallback, true)
assert.ok(readySnapshot.capabilities.includes('local-model'))
assert.ok(readySnapshot.capabilities.includes('tools'))
assert.equal(readySnapshot.missingCapabilities.length, 0)
assert.equal(readySnapshot.recommendedAction.type, 'continue')

const fallbackSnapshot = controller.useFallback()
assert.equal(fallbackSnapshot.mode, 'fallback-ready')
assert.match(fallbackSnapshot.message, /Basic fallback/)
assert.equal(fallbackSnapshot.canUseFallback, true)

const evidence = acceptanceSnapshot({ query: 'Explain strict grounding and refusal policy.' })
assert.equal(evidence.requiredTool, 'searchPublicSite')
assert.equal(evidence.grounding, 'strict')
assert.equal(evidence.fallbackLabel, 'Fallback response (no model available)')
assert.ok(evidence.matchCount > 0)
assert.ok(evidence.citations.some(citation => citation.uri === '/#grounding-policy'))

console.log('public-site-agent-user runtime checks passed')
