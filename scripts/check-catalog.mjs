import fs from 'node:fs'

const catalog = JSON.parse(fs.readFileSync(new URL('../demos/catalog.json', import.meta.url), 'utf8'))
const failures = []

if (catalog.schemaVersion !== 1) failures.push('catalog.schemaVersion must be 1')
if (!catalog.edgekitPackageRange?.startsWith('^0.3.')) failures.push('edgekitPackageRange should track the current v0.3 release line')
if (!Array.isArray(catalog.goldenDemos) || catalog.goldenDemos.length === 0) failures.push('catalog.goldenDemos must not be empty')

const agentGuide = fs.readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
for (const phrase of [
  'Read `PRODUCT-LAWS.md` first',
  'Edgekit is the governed agent user of an app',
  'Required Friction Classification',
  'When To File Against Core',
  '[demo-friction] <demo id>: <short outcome failure>',
]) {
  if (!agentGuide.includes(phrase)) failures.push(`AGENTS.md is missing required guidance: ${phrase}`)
}

const ids = new Set()
for (const demo of catalog.goldenDemos ?? []) {
  if (!demo.id) failures.push('golden demo missing id')
  if (ids.has(demo.id)) failures.push(`duplicate golden demo id: ${demo.id}`)
  ids.add(demo.id)
  if (!['live', 'needed', 'paused'].includes(demo.status)) failures.push(`${demo.id} has invalid status ${demo.status}`)
  if (!demo.outcome?.includes('Agent user') && !demo.outcome?.includes('agent user')) {
    failures.push(`${demo.id} outcome must describe the agent user outcome`)
  }
  if (!Array.isArray(demo.requiredSurfaces) || demo.requiredSurfaces.length === 0) {
    failures.push(`${demo.id} must list requiredSurfaces`)
  }
  if (!Array.isArray(demo.acceptance) || demo.acceptance.length < 3) {
    failures.push(`${demo.id} must include at least three acceptance checks`)
  }
  if (demo.status === 'live') {
    if (!demo.repo) failures.push(`${demo.id} is live but missing repo`)
    if (!demo.liveUrl) failures.push(`${demo.id} is live but missing liveUrl`)
  }
}

for (const file of [
  '../PRODUCT-LAWS.md',
  '../DEMO-TEAM.md',
  '../README.md',
  '../docs/core-feedback-loop.md',
  '../docs/golden-demo-acceptance.md',
  '../docs/friction-log-template.md',
  '../docs/session-handoff.md',
  '../labs/README.md',
]) {
  const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  if (!text.startsWith('Audience:')) failures.push(`${file} must start with Audience:`)
}

if (failures.length) {
  console.error('edgekit-demos catalog checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`edgekit-demos catalog checks passed (${catalog.goldenDemos.length} golden demos, ${(catalog.labs ?? []).length} labs)`)
