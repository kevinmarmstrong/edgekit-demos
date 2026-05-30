import fs from 'node:fs'

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}
function readText(path) {
  return fs.readFileSync(path, 'utf8')
}

const failures = []
const catalog = readJson('demos/catalog.json')
const demo = catalog.goldenDemos.find((entry) => entry.id === 'admin-workflow')
if (!demo) failures.push('catalog must include admin-workflow golden demo')
if (demo?.localPath !== 'demos/admin-workflow') failures.push('admin-workflow catalog entry must point localPath at demos/admin-workflow')
for (const surface of ['identity', 'state', 'rbac', 'read-tools', 'mutation-tools', 'approval', 'audit', 'telemetry']) {
  if (!demo?.requiredSurfaces?.includes(surface)) failures.push(`catalog missing admin surface: ${surface}`)
}

const manifest = readJson('demos/admin-workflow/manifest.json')
if (manifest.id !== 'admin-workflow') failures.push('manifest id must match admin-workflow')
for (const surface of ['identity', 'state', 'rbac', 'read-tools', 'mutation-tools', 'approval', 'audit', 'telemetry', 'cascade']) {
  if (!manifest.requiredSurfaces?.includes(surface)) failures.push(`manifest missing required surface: ${surface}`)
}
for (const check of ['local-browser-search-tool', 'rbac-policy-evaluation', 'approval-required-before-mutation', 'app-owned-approved-mutation-tool', 'audit-telemetry-records']) {
  if (!manifest.acceptanceEvidence?.includes(check)) failures.push(`manifest missing acceptance evidence: ${check}`)
}
if (manifest.edgekitLoop?.kanbanTask !== 't_3669ce11') failures.push('manifest must include EDGEKIT-LOOP metadata for this kanban task')

const pkg = readJson('demos/admin-workflow/package.json')
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (!dep.startsWith('@kevinmarmstrong/')) failures.push(`admin workflow demo must only use published @kevinmarmstrong/* runtime packages, found ${dep}`)
}

const source = readText('demos/admin-workflow/src/admin-workflow-demo.mjs')
for (const api of ['createMissionProfile', 'createAuditTrail', 'createToolPolicyExecutor']) {
  if (!source.includes(api)) failures.push(`source must use published Edgekit API: ${api}`)
}
for (const phrase of ['searchAccounts', 'evaluateAdminChange', 'requestAdminApproval', 'executeApprovedAdminChange', 'approval required before mutation', 'app-owned mutation']) {
  if (!source.includes(phrase)) failures.push(`source missing proof phrase: ${phrase}`)
}
const testSource = readText('demos/admin-workflow/src/admin-workflow-demo.test.mjs')
for (const behavior of ['blocks mutation before approval', 'executes approved mutation through app-owned tool', 'legal hold suspensions are not executable', 'rejects missing authority or missing approval']) {
  if (!testSource.includes(behavior)) failures.push(`local test missing behavior: ${behavior}`)
}
const browser = readText('demos/admin-workflow/public/browser-app.js')
for (const phrase of ['deterministic-local-browser-model', 'tool-calling-local-browser-harness', 'searchAccounts', 'evaluateAdminChange', 'requestAdminApproval', 'executeApprovedAdminChange', 'x-edgekit-app-authority']) {
  if (!browser.includes(phrase)) failures.push(`browser script missing proof phrase: ${phrase}`)
}
const scorecard = readJson('docs/golden-demo-scorecard.json')
const row = scorecard.goldenDemos.find((entry) => entry.id === 'admin-workflow')
if (!row) failures.push('scorecard must include admin-workflow row')
if (!['browser-qa-pass', 'golden-pass'].includes(row?.status)) failures.push('admin-workflow scorecard should reflect browser QA evidence after this task')
if (!row?.latestEvidence?.includes('admin-workflow')) failures.push('admin-workflow scorecard latestEvidence must point at admin workflow QA artifact')

if (failures.length) {
  console.error('admin-workflow demo checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('admin-workflow demo checks passed (RBAC, approval, app-owned mutation, audit, telemetry)')
