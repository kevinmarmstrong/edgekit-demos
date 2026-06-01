import {
  chromeAI,
  createCascadeReadinessController,
  webLLM,
} from '@kevinmarmstrong/edgekit'
import { createGroundedQaSkill } from '@kevinmarmstrong/edgekit-knowledge'
import {
  PUBLIC_SITE_AGENT_IDENTITY,
  publicSiteKnowledgeSource,
  searchPublicSite,
} from './site-content.mjs'

export const PUBLIC_SITE_NO_EVIDENCE_MESSAGE = 'I do not know from this public site evidence.'

export const EDGEKIT_PACKAGE_VERSIONS = {
  '@kevinmarmstrong/edgekit': '^0.3.2',
  '@kevinmarmstrong/edgekit-knowledge': '^0.3.2',
  '@kevinmarmstrong/edgekit-skills': '^0.3.2',
  '@kevinmarmstrong/edgekit-ui': '^0.3.2',
}

export function createPublicSiteQaKit() {
  return createGroundedQaSkill({
    id: 'public-site-agent-user',
    name: 'Public Site Grounded Q&A',
    description:
      'Answer questions about this public site from host-owned content, configured identity, and strict refusal policy.',
    toolName: 'searchPublicSite',
    source: publicSiteKnowledgeSource,
    identity: PUBLIC_SITE_AGENT_IDENTITY,
    noEvidenceMessage: PUBLIC_SITE_NO_EVIDENCE_MESSAGE,
    ambiguityPolicy:
      'If the site evidence does not support a location, biography, hardware, affiliation, or disambiguation claim, refuse it with the no-evidence response.',
    defaultTopK: 3,
    systemPrompt: [
      'You are the configured Edgekit Public Site Guide for this host app.',
      'Always call searchPublicSite before factual answers.',
      'Answer only from retrieved evidence and the configured assistant/runtime identity.',
      'Explain capability mode by distinguishing local cascade, downloadable local setup, and Basic fallback.',
      `If evidence is missing or irrelevant, say exactly: "${PUBLIC_SITE_NO_EVIDENCE_MESSAGE}"`,
      'Do not invent location, biography, hardware, affiliation, or disambiguation details.',
    ].join(' '),
  })
}

export function publicSiteModelProviders() {
  return [
    chromeAI(),
    webLLM({ model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' }),
  ]
}

export function createPublicSiteCascadeController({ providers = publicSiteModelProviders(), now } = {}) {
  const kit = createPublicSiteQaKit()
  return createCascadeReadinessController({
    providers,
    downloadPolicy: 'prompt',
    requiredCapabilities: ['local-model', 'tools'],
    tools: kit.tools,
    requiredTools: ['searchPublicSite'],
    fallback: true,
    visibilityPolicy: 'show-basic-when-local-unavailable',
    messages: {
      checking: 'Checking browser-local capability before enabling the agent user.',
      ready: 'Browser-local model is ready; full agent mode can answer with grounded site tools.',
      downloadable: 'A browser-local model can be enabled. Set it up to leave Basic fallback mode.',
      fallback:
        'Basic fallback is available for read-only grounded answers, but it is not the full product experience.',
      unavailable: 'No browser-local model is available. Use labeled Basic fallback or change capability mode.',
    },
    now,
  })
}

export async function searchPublicSiteWithToolShape(query, topK = 3) {
  const results = await publicSiteKnowledgeSource.search(query, {
    input: query,
    session: {},
    topK,
  })
  return {
    source: {
      id: publicSiteKnowledgeSource.id,
      label: publicSiteKnowledgeSource.label,
      description: publicSiteKnowledgeSource.description,
    },
    query,
    freshness: await publicSiteKnowledgeSource.freshness?.({ input: query, session: {}, topK }),
    results,
  }
}

export async function answerFromPublicSiteFallback(input) {
  const kit = createPublicSiteQaKit()
  const output = await searchPublicSiteWithToolShape(input, 3)
  const answer = kit.answerFromResults(input, output)
  return `Fallback response (no model available): ${answer}`
}

export async function handleNoModelPublicSiteAnswer(event) {
  const input = event?.input ?? ''
  if (typeof event?.callTool === 'function') {
    const output = await event.callTool('searchPublicSite', { query: input, topK: 3 }, { readOnlyOnly: true })
    const kit = createPublicSiteQaKit()
    return `Fallback response (no model available): ${kit.answerFromResults(input, output)}`
  }
  return answerFromPublicSiteFallback(input)
}

export function acceptanceSnapshot({ query = 'What capability mode is this site using?' } = {}) {
  const matches = searchPublicSite(query, { topK: 3 })
  return {
    identity: PUBLIC_SITE_AGENT_IDENTITY,
    packageVersions: EDGEKIT_PACKAGE_VERSIONS,
    requiredTool: 'searchPublicSite',
    grounding: 'strict',
    fallbackLabel: 'Fallback response (no model available)',
    matchCount: matches.length,
    citations: matches.flatMap(match => match.citations ?? []),
  }
}
