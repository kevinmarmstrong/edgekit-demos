Audience: demo-team

# Demo Team Charter

The demo team owns proof, not core implementation.

## Responsibilities

- Build and maintain external demos against published Edgekit packages.
- Keep demo apps realistic enough to expose app-operability friction.
- Record installation, runtime, and user-onboarding friction with evidence.
- Propose core changes only when the friction generalizes across apps.
- Keep demo-only helpers clearly labeled as app-owned integration.

## Non-Responsibilities

- Do not move demo-specific code into core.
- Do not patch core to satisfy one scripted demo prompt.
- Do not hide cascade, tool, approval, or telemetry failures behind fixture text.
- Do not declare Basic/search-only mode as the agentic success path.

## Friction Classification

Use this exact classification in issues and handoffs:

- `app-specific integration`: belongs in the demo app.
- `docs/onboarding gap`: docs or agent skill failed to guide the installer.
- `missing primitive`: Edgekit lacks a reusable capability needed by demos.
- `weak default`: Edgekit has the capability but the default leads adopters wrong.
- `core bug`: intended Edgekit behavior fails.
- `eval/test gap`: the failure was not covered by a durable check.

## Core Handoff Rule

A core issue or PR must include:

- demo repo and commit
- Edgekit package versions
- expected app-user outcome
- actual behavior
- reproduction steps
- local workaround, if any
- classification
- proposed acceptance test
