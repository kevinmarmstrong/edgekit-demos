Audience: demo-team

# Autonomous Demo Team

This document defines the standing autonomous team that owns Edgekit demo/lab implementation, testing, and product-feedback loops.

## Mission

Create realistic demo and lab implementations that prove Edgekit makes existing
apps tool-operable by local-first agents, while continuously discovering
friction that should become demo fixes, docs improvements, core issues, or core
PRs.

The team optimizes for two outcomes:

1. **Real-world implementation pressure** — install published `@kevinmarmstrong/*` packages, retrofit realistic app-owned tools/helpers/state, prove local/browser model tool use when available, run acceptance tests, and capture every implementation friction.
2. **Reusable demos and labs** — produce artifacts that developers, architects, founders, coding agents, and product managers can use to understand Edgekit's power.

## Operating Model

The durable queue is the Hermes Kanban board `edgekit-demos`. Workers are Hermes profiles. The gateway dispatcher owns execution and respawns workers when tasks are ready.

### Team Roster

| Role | Profile | Primary ownership |
| --- | --- | --- |
| Demo architect / product owner | `swarm4` | Turn catalog outcomes into implementable demo/lab specs, scope workflows, preserve Product Laws. |
| Demo implementation engineer | `swarm5` | Build demo/lab code against published Edgekit packages and host-app authority. |
| Browser QA / exploratory tester | `swarm6` | Use full browser automation/Chrome-style testing, screenshots, console logs, and acceptance evidence. |
| Core feedback / PR engineer | `swarm7` | Convert reusable friction into `kevinmarmstrong/edgekit` issues/PRs with evidence and tests. |
| Docs/onboarding/demo narrative | `swarm10` | Improve demo docs, handoff notes, onboarding copy, and PM/founder-facing explanations. |
| Release/update triage | `swarm11` | Watch Edgekit package/repo/PR updates and create follow-up Kanban work. |
| Integration steward / release shepherd | `swarm7` or `swarm11` | Convert review-required work into clean PRs, rejected/rework decisions, retest cards, and scorecard updates. |

If a profile is unavailable, reassign to another configured `swarm*` profile rather than inventing a new assignee.

## Required Reading For Every Worker

1. `PRODUCT-LAWS.md`
2. `DEMO-TEAM.md`
3. `AGENTS.md`
4. `docs/core-feedback-loop.md`
5. `docs/golden-demo-acceptance.md`
6. `docs/operational-maturity-loop.md`
7. `docs/github-turn-flags.md`
8. `docs/golden-demo-scorecard.json`
9. `demos/catalog.json`

## Browser QA Requirement

Testing tasks must use the `browser` toolset, not just HTTP smoke checks. A valid QA handoff includes:

- Target URL or local URL tested.
- Browser/provider/cascade state observed.
- Console errors after navigation and major interactions.
- Screenshots or screenshot paths for failures.
- App state before/after mutation attempts.
- Approval, telemetry, and audit evidence when relevant.
- Explicit pass/fail against `docs/golden-demo-acceptance.md` and the catalog acceptance items.

If browser automation is unavailable, the worker must block the task and say exactly which browser capability failed.

## Friction Classification

Every finding must use one of the repo's required classifications:

- `app-specific integration`
- `docs/onboarding gap`
- `missing primitive`
- `weak default`
- `core bug`
- `eval/test gap`

Reusable friction goes to the core repo only when it affects more than one adopter or requires an Edgekit primitive/default/doc/test change.

## Product Canaries

Treat these as urgent friction:

- tool use missing from a golden demo proof;
- lite UI path acting as a chat shell without local cascade;
- Basic/search-only fallback counted as success;
- known local-model browser stuck in Basic mode;
- weak search snippets treated as evidence;
- agent identity left to the model;
- demo workaround hiding a missing primitive or weak default.

## PR / Issue Rules

Core issues use:

```text
[demo-friction] <demo id>: <short outcome failure>
```

Core PRs must include:

- Demo repo and commit.
- Edgekit package versions.
- Expected app-user outcome.
- Actual behavior.
- Reproduction steps.
- Evidence: browser state, logs, transcript, screenshot, tool/approval/telemetry/audit details.
- Classification.
- Proposed acceptance test.
- Explanation of why the change generalizes beyond one demo.

## Trigger System

Two cron jobs keep the team moving:

1. **`edgekit-demo-team-watch`** checks for Edgekit package changes, core/demo repo default-branch changes, GitHub PR activity, GitHub issue/comment updates, and creates idempotent Kanban tasks for follow-up. Core code/package changes must trigger blocked-task review: if the new core behavior may unblock a demo/lab, `swarm11` comments/unblocks the existing card or creates a linked retry/retest card.
2. **`edgekit-demo-team-daily-qa`** runs a daily repo health/demo QA sweep and queues implementation, browser QA, docs, or core-feedback work as needed.

Both jobs should create Kanban tasks on board `edgekit-demos` with idempotency keys so repeat runs do not spam duplicates.

### Operational Maturity Rules

Read `docs/operational-maturity-loop.md` before routing or completing work.

- If blocked/review-required tasks are at or above the WIP limit, create or refresh integration-steward work before creating more implementation cards.
- Code-changing tasks must use a clean task-specific worktree. Do not keep coding in a shared dirty repo.
- Integration steward work decides whether review-required changes become PRs, rework cards, rejected local experiments, or retest cards.
- Every golden demo status change must update `docs/golden-demo-scorecard.json` with evidence.
- `npm test` and smoke checks are required but not enough for `golden-pass`; browser QA must prove the governed local/browser or app-owned tool-using path.
- Suppress trigger churn from internal triage/status comments unless they contain materially new external evidence or a user decision.
- Every GitHub issue/PR comment made by a team worker must include the `EDGEKIT-LOOP` block from `docs/github-turn-flags.md` so watchers know who posted, current status, whose turn it is, and whether to respond.

## Local Verification

Before reporting the repo as healthy:

```bash
npm test
npm run smoke:live
```

Passing smoke checks do not replace browser QA; they only prove live URLs respond.
