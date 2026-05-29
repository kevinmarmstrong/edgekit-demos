import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
  } catch (error) {
    failures.push(`${relativePath} must be readable JSON: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
  } catch (error) {
    failures.push(`${relativePath} must exist: ${error instanceof Error ? error.message : String(error)}`)
    return ''
  }
}

const catalog = readJson('demos/catalog.json')
const workerDemo = catalog?.goldenDemos?.find((demo) => demo.id === 'worker-handoff')
if (!workerDemo) failures.push('catalog must include worker-handoff golden demo')
if (workerDemo && workerDemo.localPath !== 'demos/worker-handoff') {
  failures.push('worker-handoff catalog entry must point localPath at demos/worker-handoff')
}

const manifest = readJson('demos/worker-handoff/manifest.json')
if (manifest) {
  if (manifest.id !== 'worker-handoff') failures.push('worker-handoff manifest id must match catalog id')
  for (const surface of ['cascade', 'handoff', 'server-route', 'telemetry', 'policy']) {
    if (!manifest.requiredSurfaces?.includes(surface)) failures.push(`worker-handoff manifest missing required surface: ${surface}`)
  }
  for (const check of [
    'browser-visible-cascade',
    'local-mode-bounded-task',
    'server-route-escalation',
    'server-route-explicit-authority',
    'user-facing-mode',
    'bounded-context-no-secrets',
    'telemetry-mode-transition',
  ]) {
    if (!manifest.acceptanceEvidence?.includes(check)) failures.push(`worker-handoff manifest missing acceptance evidence: ${check}`)
  }
}

const demoPackage = readJson('demos/worker-handoff/package.json')
if (demoPackage) {
  const dependencies = demoPackage.dependencies ?? {}
  const dependencyNames = Object.keys(dependencies)
  for (const required of ['@kevinmarmstrong/edgekit', '@kevinmarmstrong/edgekit-agui', '@kevinmarmstrong/edgekit-governance']) {
    if (dependencies[required] !== '^0.3.2') failures.push(`worker-handoff package must depend on ${required}@^0.3.2`)
  }
  if (demoPackage.scripts?.serve !== 'node src/worker-handoff-demo.mjs --serve') {
    failures.push('worker-handoff package must expose npm run serve for the browser proof')
  }
  const nonKevinDependencies = dependencyNames.filter((name) => !name.startsWith('@kevinmarmstrong/'))
  if (nonKevinDependencies.length) failures.push(`worker-handoff demo must only use published @kevinmarmstrong/* runtime packages, found: ${nonKevinDependencies.join(', ')}`)
}

const source = readText('demos/worker-handoff/src/worker-handoff-demo.mjs')
for (const api of ['createHandoffEnvelope', 'createToolPolicyExecutor', 'createPiiRedactor', 'createAuditTrail']) {
  if (!source.includes(api)) failures.push(`worker-handoff source must use published Edgekit API: ${api}`)
}
for (const phrase of [
  'local-browser',
  'app-owned-worker',
  'boundedHandoffContext',
  'excludedSecretKeys',
  'mode.transition',
  'createBrowserCascadeViewModel',
  'createWorkerHandoffServer',
  'local_tool.proof_received',
  'x-edgekit-app-authority',
]) {
  if (!source.includes(phrase)) failures.push(`worker-handoff source missing required proof phrase: ${phrase}`)
}

const testSource = readText('demos/worker-handoff/src/worker-handoff-demo.test.mjs')
for (const behavior of [
  'handles bounded app tasks locally',
  'escalates server-only tasks to app-owned Worker route',
  'does not leak secrets into bounded handoff context',
  'redacts arbitrary prompt PII before creating the handoff envelope',
  'caps prompt text before creating the handoff envelope',
  'records mode transition telemetry and policy outcome',
  'browser cascade view model makes local-browser tool use visible before worker escalation',
  'browser assets expose visible local-first cascade and app-owned route contract',
  'app-owned Worker route rejects handoff without explicit app authority and local proof',
  'app-owned Worker route returns sanitized envelope, telemetry, and audit after local browser proof',
]) {
  if (!testSource.includes(behavior)) failures.push(`worker-handoff local test missing behavior: ${behavior}`)
}

const readme = readText('demos/worker-handoff/README.md')
for (const phrase of [
  'Browser-facing proof',
  'User-facing mode',
  'Bounded handoff context',
  'App-owned Worker route',
  'Telemetry evidence',
  'Friction log',
]) {
  if (!readme.includes(phrase)) failures.push(`worker-handoff README missing section or phrase: ${phrase}`)
}

const indexHtml = readText('demos/worker-handoff/public/index.html')
for (const phrase of ['data-testid="local-browser-step"', 'data-testid="handoff-envelope-review"', 'data-testid="server-result"']) {
  if (!indexHtml.includes(phrase)) failures.push(`worker-handoff browser index missing visible proof surface: ${phrase}`)
}

const browserScript = readText('demos/worker-handoff/public/browser-app.js')
for (const phrase of ['summarizeVisibleDashboard', 'deterministic-local-browser-model', 'tool-calling-local-browser-harness', 'x-edgekit-app-authority', '/api/edgekit/worker-handoff']) {
  if (!browserScript.includes(phrase)) failures.push(`worker-handoff browser script missing proof phrase: ${phrase}`)
}

if (failures.length) {
  console.error('worker-handoff demo checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('worker-handoff demo checks passed (browser-facing cascade, app-owned route, policy, telemetry, bounded handoff)')
