Audience: demo-team

# GitHub Turn Flags

Edgekit autonomous teams post to GitHub issues and PRs through Kevin's GitHub account, so GitHub author alone does not tell watchers who is speaking or whose turn it is. Every autonomous team comment on Edgekit issues/PRs must include an `EDGEKIT-LOOP` metadata block.

The block is an HTML comment so it does not clutter the rendered discussion but remains available to webhook/polling triggers.

## Required Block

Append this block to every issue/PR comment created by a team worker:

```html
<!-- EDGEKIT-LOOP
team: demo-team | core-team | integration | qa | docs
actor: swarm4 | swarm5 | swarm6 | swarm7 | swarm10 | swarm11 | human
board: edgekit-demos | edgekit-core
kanban_task: t_xxxxxxxx | none
source: kanban | watcher | webhook | manual-review
status: triage | working | review-required | blocked | ready-for-review | ready-to-merge | merged | retest-needed | done | no-op
turn: demo-team | core-team | integration | qa | docs | human | none
next_owner: demo-team | core-team | integration | qa | docs | human | none
trigger: respond | ignore
reason: short-kebab-or-snake-case
-->
```

## Semantics

| Field | Meaning |
| --- | --- |
| `team` | Who is posting. |
| `actor` | Profile or human role that produced the comment. |
| `board` | Kanban board that owns the work, if any. |
| `kanban_task` | Source task ID, or `none`. |
| `source` | Why this comment exists. |
| `status` | State being reported. |
| `turn` | Who currently owns the thread after this comment. |
| `next_owner` | The team/person that should act next. Usually same as `turn`; use both so readers and parsers agree. |
| `trigger` | `respond` means watchers should create/route work for the next owner. `ignore` means this is bookkeeping/status and should not create a new response card. |
| `reason` | Compact machine-readable explanation. |

## Turn Rules

- If the comment needs a team to act, set `trigger: respond` and `next_owner` to that team.
- If the comment is just status, triage bookkeeping, or a link to a Kanban task that is already active, set `trigger: ignore`.
- If a human decision is required, set `turn: human`, `next_owner: human`, and `trigger: ignore` unless the team should also prepare something.
- If the work is done and no one should respond, use `turn: none`, `next_owner: none`, `trigger: ignore`.
- Do not rely on GitHub author because all comments may be posted as `kevinmarmstrong`.

## Examples

### Core asks demo team to retest

```markdown
Core PR #12 merged and published in `@kevinmarmstrong/edgekit@0.3.4`. Please retest worker-handoff against the new package and update the scorecard.

<!-- EDGEKIT-LOOP
team: core-team
actor: swarm7
board: edgekit-core
kanban_task: t_abcd1234
source: kanban
status: retest-needed
turn: demo-team
next_owner: demo-team
trigger: respond
reason: core-package-published-retest-demo
-->
```

### Demo team posts status only

```markdown
Demo QA confirmed this remains blocked by missing local-browser model support in the current headless QA browser. No core action requested yet.

<!-- EDGEKIT-LOOP
team: demo-team
actor: swarm6
board: edgekit-demos
kanban_task: t_abcd1234
source: kanban
status: blocked
turn: qa
next_owner: qa
trigger: ignore
reason: qa-env-missing-local-model
-->
```

### Integration steward needs human review

```markdown
The worker-handoff PR is ready for human product review. Tests pass and the scorecard has been updated to `browser-qa-pass`; do not mark `golden-pass` until real local-browser model QA lands.

<!-- EDGEKIT-LOOP
team: integration
actor: swarm7
board: edgekit-demos
kanban_task: t_abcd1234
source: kanban
status: ready-for-review
turn: human
next_owner: human
trigger: ignore
reason: product-review-needed
-->
```

## Watcher Behavior

Watchers should parse the latest comment before creating a response card:

- `trigger: ignore` => no response card unless a separate non-comment event requires one.
- `trigger: respond` with `next_owner: demo-team` => demo watcher may create/refresh a card.
- `trigger: respond` with `next_owner: core-team` => core watcher may create/refresh a card.
- `next_owner: human` or `none` => team watchers stay silent.
- Missing flag => fall back to legacy heuristics, but workers should fix future comments by adding the block.
