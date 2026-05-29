# Edgekit Demos Agent Guide

Read `PRODUCT-LAWS.md` first. This repo exists to prove that Edgekit makes
existing apps tool-operable by local-first agents through published packages.

## North Star

Edgekit is the governed agent user of an app: a tool-using agent that can do
what a user can do, and more, through app-owned tools, state readers, helpers,
Skills, Mission Profiles, cascade, approvals, telemetry, and audit.

Do not reduce demo work to Q&A, RAG, bundle size, or a chat widget. Those can be
workflow surfaces, but the product proof is app-level agent operation without
rewriting the host app.

Do not minimize tool use into an implementation detail. The local/browser model
is expected to use tools when available. Basic/search-only fallback is degraded
behavior, not the product success path.

## Canary Checklist

Stop and classify friction when you see:

- tool use treated as optional or missing from the proof;
- lite UI becoming a chat shell without local cascade;
- cascade treated as optional configuration instead of runtime/onboarding;
- Basic/search-only fallback presented as the product;
- weak search results treated as claim support;
- agent identity left to the base model;
- demo workaround hidden instead of filed against core.

## Start Order

1. Read `PRODUCT-LAWS.md`.
2. Read `DEMO-TEAM.md`.
3. Read `docs/core-feedback-loop.md`.
4. Read `docs/autonomous-demo-team.md`.
5. Read `docs/operational-maturity-loop.md`, `docs/github-turn-flags.md`, and `docs/golden-demo-scorecard.json`.
6. Read `demos/catalog.json`.
7. Run `npm test`.
8. Pick a `status: "needed"` demo or lab only if the review backlog is below the WIP limit; otherwise pick integration-steward work first.
9. Build only against published `@kevinmarmstrong/*` packages unless the task is
   explicitly a core PR.

## Demo Team Rule

The demo team owns proof and friction discovery. The Edgekit core repo owns
reusable product changes.

Keep app-specific code in demos. Send reusable product gaps to
`kevinmarmstrong/edgekit` with evidence.

## Localization And Core Boundary

Keep a hard boundary between demo localization, install config, and core
product behavior.

Keep in the demo:

- domain facts, proper nouns, sample data, transcripts, canary prompts, and
  exact answer copy;
- app-specific agent identity such as "Kevin's site agent" or "Bob the AI
  Agent";
- app-owned tools, API adapters, search indexes, scoring tweaks, and business
  rules;
- install-specific cascade choices, UI placement, styling, and copy;
- temporary local workarounds.

Send to core only when the finding points to:

- a general primitive, contract, hook, adapter, or default;
- a reusable evidence-support/refusal mechanism, not a demo keyword denylist;
- cascade/readiness/onboarding behavior that multiple adopters need;
- tool-use, approval, identity/state, telemetry, or audit contracts;
- a test/eval gap that should fail across varied examples.

Promotion rule: a demo can provide the canary transcript, but the core request
must name the broader product property. Do not ask core to hardcode this demo's
proper nouns or sample claims. Ask core to absorb the friction that made the
canary fail.

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
- Do not accept a golden demo that lacks meaningful tool use.
- Do not file vague core issues without a demo commit, transcript/log, and
  acceptance test proposal.
