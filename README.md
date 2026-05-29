Audience: demo-team

# Edgekit Demos

This repo is the demo and lab operating system for Edgekit.

Edgekit exists to make an existing app tool-operable by a local-first agent.
The agent is a governed app user: it can do what a user can do, and more,
through developer-exposed tools, state, helpers, Skills, Mission Profiles,
cascade, approvals, telemetry, and audit. Demos prove that outcome against
published packages.

This repo does not replace the Edgekit core repo and does not absorb demo app
source by default. It coordinates external demos, labs, friction reports, and
core handoff.

## Repos

- Core product: <https://github.com/kevinmarmstrong/edgekit>
- Ecommerce workflow demo: <https://github.com/kevinmarmstrong/edgekit-demo-ecommerce>
- SaaS admin workflow demo: <https://github.com/kevinmarmstrong/edgekit-demo-admin>
- Docs knowledge demo: <https://github.com/kevinmarmstrong/edgekit-demo-docs>

## Product Center

Do not reduce Edgekit to chat, Q&A, RAG, a local-model demo, a lite bundle, or a
bundle-size exercise. Those are parts of the system, not the product.

The release proof is: a developer can add a governed local-first tool-using
agent to an existing app without rewriting the app.

Every golden demo must prove meaningful tool use. Q&A only counts when it is a
read-only tool workflow with strict evidence behavior. Basic/search-only mode is
fallback, not the success state.

## Demo Team Loop

1. Read `AGENTS.md`, `PRODUCT-LAWS.md`, `DEMO-TEAM.md`,
   `docs/core-feedback-loop.md`, `docs/autonomous-demo-team.md`,
   `docs/operational-maturity-loop.md`, `docs/github-turn-flags.md`,
   and `docs/golden-demo-scorecard.json`.
2. Pick a golden demo or lab from `demos/catalog.json`.
3. Install from published `@kevinmarmstrong/*` packages.
4. Build the smallest app-owned tool/helper surface needed for the workflow.
5. Run the acceptance rubric in `docs/golden-demo-acceptance.md`.
6. Log every friction in `docs/friction-log-template.md` format.
7. Classify each friction:
   - app-specific integration
   - docs/onboarding gap
   - missing primitive
   - weak default
   - core bug
   - eval/test gap
8. Open a core issue or PR only for reusable Edgekit product gaps.

## Local Checks

```bash
npm test
npm run smoke:live
```

`npm test` validates this repo's catalog and handoff files. `smoke:live` checks
that live demo URLs respond.

## Handoff

Use `docs/session-handoff.md` when passing work to another agent/session. The
handoff must include the demo outcome, package versions, acceptance results,
friction classifications, and any proposed core issue/PR.
