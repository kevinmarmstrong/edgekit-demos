# Edgekit Demos Agent Guide

Read `PRODUCT-LAWS.md` first. This repo exists to prove that Edgekit makes
existing apps agent-operable through published packages.

## North Star

Edgekit is the governed agent user of an app. The agent can do what a user can
do, and more, through app-owned tools, state readers, helpers, Skills, Mission
Profiles, cascade, approvals, telemetry, and audit.

Do not reduce demo work to Q&A, RAG, bundle size, or a chat widget. Those can be
workflow surfaces, but the product proof is app-level agent operation without
rewriting the host app.

## Start Order

1. Read `PRODUCT-LAWS.md`.
2. Read `DEMO-TEAM.md`.
3. Read `docs/core-feedback-loop.md`.
4. Read `demos/catalog.json`.
5. Run `npm test`.
6. Pick a `status: "needed"` demo or lab.
7. Build only against published `@kevinmarmstrong/*` packages unless the task is
   explicitly a core PR.

## Demo Team Rule

The demo team owns proof and friction discovery. The Edgekit core repo owns
reusable product changes.

Keep app-specific code in demos. Send reusable product gaps to
`kevinmarmstrong/edgekit` with evidence.

## Required Friction Classification

Every finding must use one of these classifications:

- `app-specific integration`: belongs in the demo app.
- `docs/onboarding gap`: docs or agent-readable guidance failed the installer.
- `missing primitive`: Edgekit lacks a reusable capability needed by demos.
- `weak default`: Edgekit has the capability but the default leads adopters
  toward the wrong outcome.
- `core bug`: intended Edgekit behavior fails.
- `eval/test gap`: the failure was not covered by a durable check.

## When To File Against Core

Open a core issue or PR when the finding would affect more than one adopter or
when the demo had to work around a missing Edgekit primitive/default/test.

Use `docs/friction-log-template.md` and include:

- demo repo and commit
- Edgekit package versions
- expected app-user outcome
- actual behavior
- reproduction steps
- browser/provider/cascade state when relevant
- tool, approval, telemetry, or audit evidence when relevant
- local workaround, if any
- classification
- proposed acceptance test

Issue title format:

```text
[demo-friction] <demo id>: <short outcome failure>
```

## What Not To Do

- Do not patch core just to satisfy one scripted demo prompt.
- Do not move demo-specific business logic into Edgekit.
- Do not hide cascade, tool, approval, or telemetry failures behind fixture text.
- Do not call Basic/search-only mode an agentic success path.
- Do not treat a working chat answer as proof that the app is agent-operable.
- Do not file vague core issues without a demo commit, transcript/log, and
  acceptance test proposal.

