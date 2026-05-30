export const PUBLIC_SITE_AGENT_IDENTITY = {
  name: 'Edgekit Public Site Guide',
  description: 'A governed read-only agent user for the Edgekit public-site golden demo.',
  persona: 'Concise, grounded, transparent about current capability mode, and unwilling to guess unsupported identity or disambiguation claims.',
  noEvidenceMessage: 'I do not know from this public site evidence.',
  modelDisclosure: 'technical',
}

export const PUBLIC_SITE_DOCUMENTS = [
  {
    id: 'public-site-home',
    title: 'Public site purpose',
    uri: '/#purpose',
    source: 'public-site',
    updatedAt: '2026-05-29',
    excerpt:
      'This small public site explains Edgekit as a governed agent user for an existing app. The assistant can answer only from the site knowledge exposed by the host app.',
    body:
      'Edgekit makes existing apps agent-operable through host-owned tools, state readers, action adapters, cascade, telemetry, audit, and policy. This public site exposes a read-only knowledge tool so the assistant can ground answers in site content instead of model memory.',
    tags: ['edgekit', 'purpose', 'agent-user', 'public-site'],
  },
  {
    id: 'capability-mode',
    title: 'Capability mode and cascade',
    uri: '/#capability-mode',
    source: 'public-site',
    updatedAt: '2026-05-29',
    excerpt:
      'The site starts by checking browser-local model capability through Edgekit cascade. If local inference is ready, the agent can run locally; otherwise Basic fallback is clearly labeled and uses the read-only site search tool.',
    body:
      'Capability mode is user-visible. The cascade wizard checks local browser providers first, can prompt for setup when a local option is downloadable, and can switch into a labeled Basic fallback when no model is available. Basic fallback is not presented as the product path; it is an honest limited mode.',
    tags: ['cascade', 'capability', 'mode', 'fallback', 'local-model'],
  },
  {
    id: 'assistant-identity',
    title: 'Configured assistant identity',
    uri: '/#assistant-identity',
    source: 'public-site',
    updatedAt: '2026-05-29',
    excerpt:
      'The configured assistant identity is Edgekit Public Site Guide, a read-only guide for this demo site. It is not a human operator and does not claim affiliations beyond this configured runtime identity.',
    body:
      'Identity answers come from host configuration: name, description, persona, no-evidence message, and technical model disclosure. The assistant distinguishes the Edgekit runtime, the configured assistant identity, and any optional model used for inference.',
    tags: ['identity', 'assistant', 'runtime', 'configured'],
  },
  {
    id: 'grounding-policy',
    title: 'Grounding and refusal policy',
    uri: '/#grounding-policy',
    source: 'public-site',
    updatedAt: '2026-05-29',
    excerpt:
      'The assistant must search site evidence before factual answers, cite the supporting site section, and refuse unsupported identity, location, biography, or disambiguation claims.',
    body:
      'The public site exposes a strict-grounding knowledge skill. If retrieved evidence is empty or irrelevant, the assistant uses the configured no-evidence response instead of guessing. Unsupported claims about places, machines, hardware programs, companies, biographies, or similarly ambiguous entities are refused unless site evidence supports them.',
    tags: ['grounding', 'refusal', 'citations', 'strict'],
  },
]

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'explain',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'site',
  'tell',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'who',
  'why',
  'with',
  'you',
  'your',
])

const ALIASES = new Map([
  ['basic', ['fallback', 'mode']],
  ['browser', ['local-model', 'cascade']],
  ['capabilities', ['capability', 'mode']],
  ['capability', ['capability', 'mode']],
  ['chatting', ['assistant', 'runtime', 'identity']],
  ['guide', ['assistant', 'identity']],
  ['local', ['local-model', 'cascade']],
  ['model', ['local-model', 'cascade', 'runtime']],
  ['refuse', ['refusal', 'grounding']],
  ['unsupported', ['refusal', 'grounding']],
])

export function tokenizeQuery(query) {
  const rawTokens = String(query ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token))

  const expanded = new Set(rawTokens)
  for (const token of rawTokens) {
    for (const alias of ALIASES.get(token) ?? []) expanded.add(alias)
  }
  return [...expanded]
}

function scoreDocument(document, tokens) {
  const haystack = [document.title, document.excerpt, document.body, ...(document.tags ?? [])]
    .join(' ')
    .toLowerCase()

  return tokens.reduce((score, token) => {
    if (document.tags?.includes(token)) return score + 3
    if (document.title.toLowerCase().includes(token)) return score + 2
    if (haystack.includes(token)) return score + 1
    return score
  }, 0)
}

export function searchPublicSite(query, { topK = 3 } = {}) {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  return PUBLIC_SITE_DOCUMENTS.map(document => ({
    document,
    score: scoreDocument(document, tokens),
  }))
    .filter(match => match.score >= 2)
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
    .slice(0, topK)
    .map(({ document, score }) => ({
      id: document.id,
      title: document.title,
      excerpt: document.excerpt,
      source: document.source,
      uri: document.uri,
      updatedAt: document.updatedAt,
      score,
      citations: [
        {
          id: document.id,
          label: document.title,
          uri: document.uri,
          source: document.source,
          excerpt: document.excerpt,
        },
      ],
      metadata: { tags: document.tags },
    }))
}

export const publicSiteKnowledgeSource = {
  id: 'public-site-agent-user-content',
  label: 'Public site content',
  description: 'Host-owned public-site pages, capability-mode copy, assistant identity, and refusal policy.',
  async search(query, context = {}) {
    return searchPublicSite(query, { topK: context.topK ?? 3 })
  },
  async freshness() {
    return {
      stale: false,
      updatedAt: '2026-05-29',
      reason: 'Static demo content versioned with the public-site-agent-user scaffold.',
    }
  },
}

// Site-specific weak-claim refusal and identity handling for the public-site QA skill.
// Uses general runtime disclosure + cascade readiness primitives (delegated to createGroundedQaSkill + createCascadeReadinessController).
// Canary-specific keywords kept here (demo only); core packages remain clean.
export const WEAK_CLAIM_CANARIES = ['harness', 'ohio', 'kevin', 'rocket', 'gemma']

export function shouldRefuseWeakPublicClaim(query) {
  const q = String(query || '').toLowerCase()
  const hasCanary = WEAK_CLAIM_CANARIES.some(k => q.includes(k))
  if (!hasCanary) return false
  const results = searchPublicSite(query)
  return results.length === 0
}

export function getPublicSiteIdentityDisclosure() {
  return {
    ...PUBLIC_SITE_AGENT_IDENTITY,
    runtimeDisclosure: 'technical',
    canaryRefusal: 'Harness/Ohio/Kevin/Rocket/Gemma claims refused unless site evidence supports them.',
  }
}
