Audience: demo-team

# Tool Surface Retrofit Lab Friction Log

## Summary

- Demo: `tool-surface-retrofit-lab`
- Repo/commit: `edgekit-demos` working tree on `feat/worker-handoff` (review before merge)
- Edgekit package versions: `@kevinmarmstrong/edgekit@0.3.2`, `@kevinmarmstrong/edgekit-governance@0.3.2`
- Environment: Node v25.9.0, npm 11.12.1
- Workflow attempted: governed agent user schedules same-day maintenance for `WO-1042` after reading work-order and technician state.

## Findings

### Domain-specific dispatch selectors remain app-owned

- Expected outcome: the agent user can inspect work-order and technician state without owning app state.
- Actual behavior: the lab had to expose narrow app selectors as tools because dispatch state shape is business-specific.
- Evidence: `src/non-agent-app.mjs` selectors and `src/tool-surface.mjs` tools `readWorkOrder` / `listTechnicians`.
- Classification: `app-specific integration`
- Local workaround: keep selectors in the host app and expose only minimal readers.
- Core proposal: none.

### Same-day maintenance approval is business policy

- Expected outcome: risky mutations are visible and approval-gated before host state changes.
- Actual behavior: approval policy depends on occupied-building maintenance rules and belongs in the app.
- Evidence: `scheduleSameDayVisit` refuses to call `host.actions.scheduleSameDayVisit` unless approval succeeds; denial test leaves assignment unchanged.
- Classification: `app-specific integration`
- Local workaround: require an `approvalId` in the host mutation adapter.
- Core proposal: none.

### Claim support is enforced by lab-local evidence IDs

- Expected outcome: factual/workflow claims should be provably grounded in prior app-owned reads.
- Actual behavior: Edgekit governance provides audit/tool policy primitives, but this lab still needs local claim-to-tool-result evidence wiring.
- Evidence: each claim produced by `runAgentUserWorkflow` carries `tool-result:readWorkOrder:*` evidence; tests assert evidence and ordering.
- Classification: `missing primitive`
- Local workaround: attach telemetry event IDs to claims in the lab runner.
- Core proposal: reusable claim-support helper that validates response claims cite prior tool results before UI surfacing.

### Regression check for read-before-claim was added only in this lab

- Expected outcome: demo/lab acceptance should durably test tool-call ordering, approvals, and host-adapter-only mutations.
- Actual behavior: root catalog checks do not enforce those workflow invariants across labs yet.
- Evidence: `test/retrofit-workflow.test.mjs` contains lab-local ordering, approval, adapter, and friction checks.
- Classification: `eval/test gap`
- Local workaround: keep lab-local Node tests until a shared harness exists.
- Core proposal: shared demo acceptance harness for read-before-claim, approval gates, telemetry/audit, and host-adapter-only mutations.
