Audience: demo-team

# Operational Maturity Loop

This loop exists to improve the Edgekit product outcome, not to maximize code, tasks, comments, or turns.

## Definition Of Done

A product improvement is not done when an agent writes code. It is done when the loop reaches a verified product state:

```text
demo evidence
→ classified product friction
→ focused core/demo change
→ reviewed PR or explicit rejected decision
→ merged/published package or demo update
→ browser QA retest
→ golden scorecard updated
→ linked issue closed or left blocked with a named reason
```

## Operating Principles

1. **Outcome over activity** — prefer one landed product primitive and one retested golden demo over many local patches.
2. **Review backlog is WIP** — review-required tasks count as active work. Do not start broad implementation while review backlog is high.
3. **Integration is a first-class role** — a steward owns turning review-required work into clean PRs, rejections, or retest cards.
4. **Clean isolation beats speed** — code-changing tasks must use a clean worktree or stop immediately.
5. **Golden-pass is explicit** — `npm test` and smoke checks are necessary but never sufficient for golden-demo success.
6. **Core absorbs properties, not transcripts** — core may take reusable contracts/tests/defaults, never demo-specific canary words or business facts.

## WIP Limits

When either board has **3 or more blocked/review-required tasks**, trigger jobs may continue to record new GitHub issue/PR intake, but they should suppress non-critical implementation fan-out and create/refresh an integration-steward card instead.

Default limits:

| Limit | Value |
| --- | --- |
| Max blocked/review-required tasks before integration mode | 3 |
| Max simultaneous implementation lanes per board | 2 |
| Max response cards per issue/PR without material external change | 1 active card |

## Integration Steward Contract

The integration steward optimizes for product convergence.

For each review-required task, the steward must:

1. Identify the exact task, issue, branch/worktree, changed files, and claimed tests.
2. Isolate the diff from unrelated dirty state.
3. Re-run the relevant checks.
4. Apply the product gates:
   - local/browser tool-use path is real or explicitly blocked by environment;
   - Basic/Lite/search-only is labeled fallback, not golden success;
   - host app owns state, tools, identity, permissions, approvals, telemetry, and audit;
   - core code contains no demo-specific proper nouns, canary prompts, or one-demo business rules;
   - reusable core changes have generic tests over at least two fixtures when feasible.
5. Decide one of:
   - create/open PR;
   - request a focused rework card;
   - close as demo-only/app-specific;
   - create retest card after merge/publish;
   - reject the change and document why.
6. Update the golden scorecard and linked GitHub issue/PR.

## Worktree Discipline

Code-changing tasks must use clean task-specific workspaces:

```text
edgekit core:  /Users/kevinarmstrong/Documents/edgekit-worktrees/<task-or-issue>
edgekit demos: /Users/kevinarmstrong/Documents/edgekit-demos-worktrees/<task-or-issue>
```

If a worker sees unrelated dirty files in the target repo, it must not continue coding in that repo. It should block with:

```text
blocked: dirty workspace prevents safe isolated change; needs integration steward
```

The shared repos may be used for read-only inspection, tests, and integration-steward review, but not for new implementation lanes while dirty.

## Golden Demo Scorecard

Each golden demo must carry a scorecard row with:

- `status`: `needed`, `scaffolded`, `browser-qa-pass`, `golden-pass`, `blocked-by-core`, `blocked-by-env`, or `rework-required`;
- local/browser tool use;
- cascade/runtime onboarding;
- Basic fallback honesty;
- real workflow completion;
- host-owned mutation path;
- approval/audit/telemetry evidence;
- grounding/refusal where applicable;
- latest evidence artifact;
- linked core/demo issue and PR state.

A demo can only be `golden-pass` when browser QA exercises the primary governed tool-using path or explicitly proves that a real local/browser model path is available and used. Basic fallback alone cannot pass.

## Trigger Hygiene

Watchers should not generate tasks for their own bookkeeping comments. Every autonomous team comment should include the `EDGEKIT-LOOP` block from `docs/github-turn-flags.md`; watchers use that block before falling back to text heuristics.

Structured rules:

- `trigger: ignore` means no response card for that comment.
- `trigger: respond` plus `next_owner: demo-team` means the demo watcher may route work.
- `trigger: respond` plus `next_owner: core-team` means the core watcher may route work.
- `next_owner: human` or `next_owner: none` means team watchers stay silent.
- Missing `EDGEKIT-LOOP` means external/unknown; use the legacy heuristics below.

Legacy fallback: suppress response-card creation when the latest GitHub comment is clearly an internal loop update such as:

- `Core triage update:`
- `Demo triage update:`
- `Triage update:`
- `Implementation status from kanban task`
- `Follow-up routing update:`
- `Routing correction/update:`
- `Browser evidence for the existing`

If the comment contains a user decision, review request, failed CI, new package release, or explicit new evidence, create a response card.

## Daily Health Question

Every daily QA or integration report should answer:

> What changed the Edgekit product outcome today?

Valid answers look like:

- “worker-handoff moved from scaffolded to browser-qa-pass with bounded handoff evidence.”
- “claim-support primitive rejected because demo-specific terms leaked into core.”
- “cascade helper landed, package published, public-site demo retested against new version.”

Invalid answers:

- “created five tasks.”
- “added 700 LOC.”
- “tests passed” without a scorecard/product-state change.
