Audience: demo-team

# Session Handoff

Use this when handing the demos/labs track to another session.

## Current Objective

Build and validate Edgekit demos that prove existing apps can become
agent-operable through published Edgekit packages.

## Product Invariant

Edgekit is the governed agent user of the app. Tool use and host-owned
workflows are the center. Q&A is one read-only workflow, not the product.

## Current Repos

- Core: `kevinmarmstrong/edgekit`
- Demo coordination: `kevinmarmstrong/edgekit-demos`
- Ecommerce: `kevinmarmstrong/edgekit-demo-ecommerce`
- Admin: `kevinmarmstrong/edgekit-demo-admin`
- Docs: `kevinmarmstrong/edgekit-demo-docs`

## Start Here

1. Read `AGENTS.md`.
2. Read `PRODUCT-LAWS.md`.
3. Read `DEMO-TEAM.md`.
4. Read `docs/core-feedback-loop.md`.
5. Read `demos/catalog.json`.
6. Run `npm test`.
7. Pick one `status: "needed"` demo/lab.
8. Build against published packages only.
9. Log friction with `docs/friction-log-template.md`.
10. Open core issues/PRs only for reusable product gaps.

## Current High-Priority Labs

- `public-site-agent-user`: restore cascade as the default public-site agent path and prove unsupported identity/disambiguation claims refuse.
- `worker-handoff`: prove local-first agent user can escalate to app-owned Worker/server capability.
- `cascade-runtime-onboarding-lab`: design first-visit and mode-change UX.

## Definition Of Done

The demo/lab passes its acceptance checklist and every workaround is classified
as app-specific or filed against core with evidence.
