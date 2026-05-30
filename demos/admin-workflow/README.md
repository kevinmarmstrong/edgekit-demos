Audience: demo-team

# Enterprise admin workflow golden demo

This demo proves an internal enterprise admin console can expose app-owned read, policy, approval, mutation, audit, and telemetry surfaces to a governed Edgekit agent user without moving admin business logic into core.

The success path is not Basic/search-only chat. The browser page exposes a deterministic local/browser model harness named `deterministic-local-browser-model` with capability `tool-calling-local-browser-harness`. It calls app-owned tools in order:

1. `searchAccounts` reads visible account/role/policy context.
2. `evaluateAdminChange` proposes a risky plan upgrade, suspension, or role grant and returns RBAC plus approval requirements.
3. `requestAdminApproval` records the approval gate.
4. `executeApprovedAdminChange` runs only after explicit approval through `/api/edgekit/admin-workflow` with `x-edgekit-app-authority: admin-workflow-demo`.

The host app remains the source of truth for account state, role policy, approvals, telemetry, and audit. Demo-specific account records, RBAC rules, and approval wording intentionally stay in this demo (`app-specific integration`).

## Run

```bash
npm --prefix demos/admin-workflow test
node scripts/check-admin-workflow-demo.mjs
node scripts/run-admin-workflow-browser-qa.mjs
```

## Review state

This scaffold should remain `browser-qa-pass` until review/merge and retest from a clean integrated branch.

<!-- EDGEKIT-LOOP
team: demo-team
actor: swarm6
board: edgekit-demos
kanban_task: t_3669ce11
source: kanban
status: review-required
turn: human
next_owner: human
trigger: ignore
reason: enterprise-admin-demo-review
-->
