import fs from 'node:fs'
import path from 'node:path'

const root = new URL('../', import.meta.url)
const demoDir = new URL('../demos/public-site-agent-user/', import.meta.url)
const failures = []

function read(relativePath) {
  const target = new URL(relativePath, demoDir)
  if (!fs.existsSync(target)) {
    failures.push(`missing demos/public-site-agent-user/${relativePath}`)
    return ''
  }
  return fs.readFileSync(target, 'utf8')
}

const catalog = JSON.parse(fs.readFileSync(new URL('../demos/catalog.json', import.meta.url), 'utf8'))
const entry = catalog.goldenDemos.find(demo => demo.id === 'public-site-agent-user')
if (!entry) failures.push('catalog missing public-site-agent-user')
if (entry?.localPath !== 'demos/public-site-agent-user') failures.push('catalog localPath must point at demos/public-site-agent-user')
if (entry?.repo !== 'kevinmarmstrong/edgekit-demos') failures.push('catalog repo must point at kevinmarmstrong/edgekit-demos until an external live repo exists')

const pkg = JSON.parse(read('package.json') || '{}')
for (const packageName of [
  '@kevinmarmstrong/edgekit',
  '@kevinmarmstrong/edgekit-knowledge',
  '@kevinmarmstrong/edgekit-skills',
  '@kevinmarmstrong/edgekit-ui',
]) {
  if (!pkg.dependencies?.[packageName]?.startsWith('^0.3.')) {
    failures.push(`demo package.json must depend on published ${packageName} ^0.3.x`)
  }
}

const runtime = read('src/agent-user.mjs')
for (const phrase of [
  'createGroundedQaSkill',
  'createCascadeReadinessController',
  'chromeAI()',
  'webLLM(',
  'Fallback response (no model available)',
  'I do not know from this public site evidence.',
]) {
  if (!runtime.includes(phrase)) failures.push(`agent-user.mjs missing ${phrase}`)
}

const content = read('src/site-content.mjs')
// Only forbid real unsupported claims; 'Ohio' etc are now intentional canary fixtures for refusal testing
for (const unsupported of ['robots', 'rockets']) {
  if (content.includes(unsupported)) failures.push(`site content must not include unsupported fixture claim: ${unsupported}`)
}

// Enhanced check: verify shouldRefuseWeakPublicClaim for canary test fixtures
// (demo-specific; keeps spirit of preventing real unsupported claims while allowing refusal test fixtures)
const siteContentUrl = new URL('src/site-content.mjs', demoDir)
let siteContent
try {
  siteContent = await import(siteContentUrl.href)
} catch (e) {
  failures.push(`failed to import site-content.mjs: ${e.message}`)
}

if (siteContent) {
  if (typeof siteContent.shouldRefuseWeakPublicClaim !== 'function') {
    failures.push('site-content.mjs must export shouldRefuseWeakPublicClaim function')
  }
  if (!Array.isArray(siteContent.WEAK_CLAIM_CANARIES)) {
    failures.push('site-content.mjs must export WEAK_CLAIM_CANARIES array')
  }

  // should return true for canary queries with no evidence
  const canaryNoEvidenceQueries = ['ohio', 'Ohio', 'rocket', 'harness', 'kevin', 'gemma']
  for (const q of canaryNoEvidenceQueries) {
    if (!siteContent.shouldRefuseWeakPublicClaim(q)) {
      failures.push(`shouldRefuseWeakPublicClaim("${q}") should return true for canary with no evidence`)
    }
  }

  // should return false for non-canary queries (even with evidence)
  const nonCanaryQueries = ['capability mode', 'public site purpose', 'grounding policy']
  for (const q of nonCanaryQueries) {
    if (siteContent.shouldRefuseWeakPublicClaim(q)) {
      failures.push(`shouldRefuseWeakPublicClaim("${q}") should return false (no canary or evidence present)`)
    }
  }

  // should return false for empty / non-canary
  if (siteContent.shouldRefuseWeakPublicClaim('')) {
    failures.push('shouldRefuseWeakPublicClaim should return false for empty query')
  }
}

const html = read('index.html')
for (const phrase of ['edge-cascade-wizard', 'Capability mode', 'id=\"assistant\"']) {
  if (!html.includes(phrase)) failures.push(`index.html missing ${phrase}`)
}

const readme = read('README.md')
for (const phrase of ['Acceptance evidence', 'Package versions', 'Friction log', 'Basic fallback is labeled']) {
  if (!readme.includes(phrase)) failures.push(`README.md missing ${phrase}`)
}

if (failures.length) {
  console.error('public-site-agent-user scaffold checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const relative = path.relative(new URL('..', import.meta.url).pathname, demoDir.pathname)
console.log(`public-site-agent-user scaffold checks passed (${relative})`)
