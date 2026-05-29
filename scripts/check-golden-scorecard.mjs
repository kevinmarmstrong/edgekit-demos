import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'demos', 'catalog.json');
const scorecardPath = path.join(root, 'docs', 'golden-demo-scorecard.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const scorecard = JSON.parse(fs.readFileSync(scorecardPath, 'utf8'));

const validStatuses = new Set([
  'needed',
  'scaffolded',
  'browser-qa-pass',
  'golden-pass',
  'blocked-by-core',
  'blocked-by-env',
  'rework-required',
  'implemented'
]);

const catalogGoldenIds = new Set((catalog.goldenDemos ?? []).map((demo) => demo.id));
const scorecardGolden = scorecard.goldenDemos ?? [];
const scorecardGoldenIds = new Set(scorecardGolden.map((demo) => demo.id));

const errors = [];

for (const id of catalogGoldenIds) {
  if (!scorecardGoldenIds.has(id)) {
    errors.push(`golden demo ${id} is missing from docs/golden-demo-scorecard.json`);
  }
}

for (const demo of scorecardGolden) {
  if (!catalogGoldenIds.has(demo.id)) {
    errors.push(`scorecard has unknown golden demo ${demo.id}`);
  }
  if (!validStatuses.has(demo.status)) {
    errors.push(`scorecard demo ${demo.id} has invalid status ${demo.status}`);
  }
  for (const field of ['localBrowserToolUse', 'cascadeRuntimeOnboarding', 'basicFallbackHonesty', 'realWorkflowCompletion', 'latestEvidence', 'nextGate']) {
    if (!demo[field] || typeof demo[field] !== 'string') {
      errors.push(`scorecard demo ${demo.id} missing string field ${field}`);
    }
  }
  if (demo.status === 'golden-pass') {
    const evidence = [
      demo.localBrowserToolUse,
      demo.realWorkflowCompletion,
      demo.basicFallbackHonesty,
      demo.approvalAuditTelemetry ?? '',
      demo.hostOwnedMutationPath ?? ''
    ].join('\n').toLowerCase();
    if (/(fail|not-verified|not verified|not-exercised|blocked|partial)/.test(evidence)) {
      errors.push(`scorecard demo ${demo.id} cannot be golden-pass with failing/partial evidence`);
    }
  }
}

const catalogLabIds = new Set((catalog.labs ?? []).map((lab) => lab.id));
const scorecardLabIds = new Set((scorecard.labs ?? []).map((lab) => lab.id));
for (const id of catalogLabIds) {
  if (!scorecardLabIds.has(id)) {
    errors.push(`lab ${id} is missing from docs/golden-demo-scorecard.json`);
  }
}

if (errors.length) {
  console.error('golden scorecard check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`golden scorecard checks passed (${scorecardGolden.length} golden demos, ${(scorecard.labs ?? []).length} labs)`);
