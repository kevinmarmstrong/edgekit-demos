Audience: demo-team

# Local/browser model QA lane

This lane makes golden-demo browser QA verifiable when the live QA browser does not expose a real `window.ai.languageModel`/Prompt API.

## Decision

Preferred order:

1. Real Chrome AI / Prompt API, if the Mac's Chrome profile exposes `window.ai.languageModel`, `window.ai.LanguageModel`, or global `LanguageModel` in the tested browser context.
2. WebLLM test profile, if a repo-pinned WebLLM profile and model cache are available.
3. Deterministic model-backed acceptance harness, if neither real provider is available.

Current Mac decision: use the deterministic model-backed acceptance harness for repeatable CI/local evidence. Chrome 148 is installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, but the QA probe still reports no `window.ai`, no language model API, and no WebLLM object in the browser context. Basic/search-only fallback remains a degraded path and is not counted as golden success.

## Setup commands

From the repo root:

```bash
PATH=/opt/homebrew/bin:$PATH npm install --include=dev
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run qa:local-browser-model
```

Optional Chrome override:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run qa:local-browser-model
```

The QA script launches real headless Chrome through the Chrome DevTools Protocol, probes provider availability with Chrome AI flags, starts the local `worker-handoff` demo server, drives the browser page, captures a screenshot, and writes evidence under:

```text
qa-artifacts/<YYYY-MM-DD>/local-browser-model-lane/
```

## What the deterministic harness proves

The `worker-handoff` browser page now exposes a deterministic local/browser model harness named `deterministic-local-browser-model` with capability `tool-calling-local-browser-harness`.

The harness is intentionally narrow. It proves the model lane can:

- select and call the local browser tool `summarizeVisibleDashboard` before server handoff;
- read visible host-app state rather than answer from Basic/search-only fallback;
- classify a warehouse billing report as requiring app-owned Worker/server capability;
- send completed local proof and explicit `x-edgekit-app-authority` to the app-owned route;
- execute `generateBillingVarianceReport` through host-owned policy;
- emit mode transition, tool outcome, server completion telemetry, and audit entries;
- keep prompt PII and app secrets out of the handoff review and server result.

This does not certify a general-purpose ML model. It certifies the app-owned local/browser tool-use contract in a real browser until a real Chrome AI or WebLLM provider is available on this Mac.

## Scorecard policy

A passing deterministic lane can move a demo from `blocked-by-env` to `browser-qa-pass` only when the browser evidence covers the demo's required surfaces. It should not promote a demo to `golden-pass` until the implementation is reviewed/merged and retested from a clean integrated branch, or until a real local/browser model provider is available and exercised.

## Artifact policy

Commit the reproducible lane definition and harness, not generated run output:

- Durable repo artifacts: this document, `scripts/run-local-browser-model-qa.mjs`, the `qa:local-browser-model` npm script, and `.gitignore` entries for generated evidence.
- GitHub/Kanban evidence: summarize dated reports, provider probes, screenshot names, console status, and command output in task/PR comments when they support a product decision.
- Local-only generated artifacts: `dogfood-output/` and `qa-artifacts/` contain dated screenshots, logs, raw evidence JSON, and generated reports. They are intentionally ignored so cleanup can remove/regenerate them after their findings have been captured in handoffs.

## Blocked environment classification

If `npm run qa:local-browser-model` fails before exercising the deterministic harness, classify as `blocked-by-env` with the exact missing capability:

- missing Chrome executable: install Chrome or set `CHROME_PATH`;
- no DevTools endpoint: Chrome launch policy/profile issue;
- Chrome AI unavailable: expected on this Mac today; continue with deterministic harness;
- WebLLM unavailable: no repo-pinned WebLLM test profile/cache has been added yet.
