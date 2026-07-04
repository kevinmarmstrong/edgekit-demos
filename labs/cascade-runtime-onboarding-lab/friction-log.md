Audience: demo-team

# Cascade Runtime Onboarding Lab Friction Log

## Package versions

- `@kevinmarmstrong/edgekit@0.3.2`
- `@kevinmarmstrong/edgekit-governance@0.3.2`

## Findings

### 1. Lab needs app-owned scenario fixtures for browser/provider states

- Classification: `app-specific integration`
- Expected app-user outcome: a first-time user sees an accurate runtime mode based on browser local model availability, WebLLM downloadability, and app server fallback configuration.
- Actual behavior: a static lab cannot force real browser model availability in Node or every browser, so the lab wraps `createCascadeReadinessController` with app-owned provider fixtures and exposes the same user transitions.
- Local workaround: `src/runtime-onboarding.js` provides scenario-controlled providers while preserving Edgekit readiness controller behavior.
- Core handoff: none. This is expected demo scaffolding.

### 2. Cloud/server route readiness is represented by provider id rather than a dedicated UX mode name

- Classification: `weak default`
- Expected app-user outcome: user sees “cloud/server route configured” as a distinct fallback from browser-local model and Basic fallback.
- Actual behavior: the Edgekit readiness snapshot correctly includes `cloud-route` capability and provider id, but the high-level `mode` string remains generic model readiness. The lab UI therefore keys cloud copy from `recommendedAction.provider` and capabilities.
- Local workaround: the app-owned view model labels provider `cloud-route` as “App-owned cloud/server route” and states that bounded context goes to `/api/edgekit/cascade`.
- Core handoff: consider after QA if multiple demos need a clearer `cloud-ready` display mode or copy helper.

### 3. No durable acceptance existed for runtime onboarding mode transitions

- Classification: `eval/test gap`
- Expected app-user outcome: regressions in WebLLM prompt/download, cloud fallback, Basic fallback labeling, retry/change, telemetry, or audit are caught before handoff.
- Actual behavior: catalog checks did not exercise this lab surface.
- Local workaround: added `npm run lab:cascade-onboarding` to exercise the scaffold.
- Core handoff: none yet; keep as demo repo check unless the same acceptance shape becomes a reusable Edgekit eval.
