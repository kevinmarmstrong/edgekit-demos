Audience: demo-team

# Edgekit Demos

This repo is the demo and lab operating system for Edgekit.

Edgekit exists to make an existing app agent-operable. The agent is a governed
app user: it can do what a user can do, and more, through developer-exposed
tools, state, helpers, Skills, Mission Profiles, cascade, approvals, telemetry,
and audit. Demos prove that outcome against published packages.

This repo does not replace the Edgekit core repo and does not absorb demo app
source by default. It coordinates external demos, labs, friction reports, and
core handoff.

## Repos

- Core product: <https://github.com/kevinmarmstrong/edgekit>
- Ecommerce workflow demo: <https://github.com/kevinmarmstrong/edgekit-demo-ecommerce>
- SaaS admin workflow demo: <https://github.com/kevinmarmstrong/edgekit-demo-admin>
- Docs knowledge demo: <https://github.com/kevinmarmstrong/edgekit-demo-docs>

## Product Center

Do not reduce Edgekit to chat, Q&A, RAG, a local-model demo, or a bundle-size
exercise. Those are parts of the system, not the product.

The release proof is: a developer can add a governed agent user to an existing
app without rewriting the app.

## Demo Team Loop

1. Pick a golden demo or lab from `demos/catalog.json`.
2. Install from published `@kevinmarmstrong/*` packages.
3. Build the smallest app-owned tool/helper surface needed for the workflow.
4. Run the acceptance rubric in `docs/golden-demo-acceptance.md`.
5. Log every friction in `docs/friction-log-template.md` format.
6. Classify each friction:
   - app-specific integration
   - docs/onboarding gap
   - missing primitive
   - weak default
   - core bug
   - eval/test gap
7. Open a core issue or PR only for reusable Edgekit product gaps.

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
