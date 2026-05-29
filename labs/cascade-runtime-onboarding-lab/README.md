Audience: demo-team

# Cascade Runtime Onboarding Lab

This lab prototypes the first-visit and mode-change UX for Edgekit cascade readiness. It is centered on a governed app-level agent user, not chat or RAG: the host app owns identity, state, policy, tools, telemetry, and audit while Edgekit reports runtime capability and routes the app toward a safe mode.

## What it exposes

- Browser/local model detection before the app shows agent-operable features.
- A WebLLM download path that requires explicit user action and records provider status.
- An app-owned cloud/server route when configured, with bounded context called out in the UI copy.
- Basic fallback as a clearly labeled setup/fallback state, not the product success path.
- User-triggered retry and mode changes after first visit.
- Telemetry and audit entries for mode transitions, provider status, and download prompts.

## Published packages used

- `@kevinmarmstrong/edgekit@0.3.2`
  - `createCascadeReadinessController`
  - `createModelProvider`
- `@kevinmarmstrong/edgekit-governance@0.3.2`
  - `createAuditTrail`

No Edgekit core patch is required for this scaffold.

## Local checks

From the repo root:

```bash
npm test
npm run lab:cascade-onboarding
```

The lab check exercises browser-local readiness, WebLLM downloadable/downloaded transitions, configured cloud fallback, Basic fallback labeling, user retry/change, and telemetry/audit evidence.

## Scenario map

| Scenario | Expected app outcome |
| --- | --- |
| `browserReady` | User lands directly in browser-local governed agent mode. |
| `webLLMDownload` | User sees a WebLLM download prompt; after consent, local agent mode becomes available. |
| `cloudConfigured` | If local is unavailable and the app has configured a server route, the user can continue through the app-owned cloud/server fallback. |
| `basicOnly` | User sees Basic fallback as setup guidance only and is prompted to retry/change mode later. |

## Host authority contract

The lab deliberately keeps authority in app-owned integration code:

- Runtime policy and user mode changes are represented as host-owned tools.
- Cloud/server fallback is configured by the host app (`/api/edgekit/cascade` in the fixture), not by Edgekit core.
- Basic mode cannot claim agentic success or mutate app state.
- Telemetry/audit evidence belongs to the host app and records every mode transition.

## Files

- `index.html` — static browser surface for the lab.
- `src/runtime-onboarding.js` — reusable lab runtime that wraps published Edgekit cascade/governance primitives.
- `check.mjs` — local acceptance check for the required surfaces.
- `friction-log.md` — classified friction and follow-up notes.
