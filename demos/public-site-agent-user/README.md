# Public Site Agent User Golden Demo

This scaffold implements the `public-site-agent-user` golden demo inside the demo coordination repo until it is split to a dedicated live repo. It proves the app-user outcome for a small public site: answer grounded questions, explain capability mode, use browser-local cascade when available, and refuse unsupported identity/disambiguation claims.

## Package versions

Published `@kevinmarmstrong/*` packages only:

- `@kevinmarmstrong/edgekit`: `^0.3.2`
- `@kevinmarmstrong/edgekit-knowledge`: `^0.3.2`
- `@kevinmarmstrong/edgekit-skills`: `^0.3.2`
- `@kevinmarmstrong/edgekit-ui`: `^0.3.2`

`vite` is dev-only scaffolding for local browser serving/building. It is not an Edgekit product dependency and is included only so the demo can be exercised locally without inventing a custom bundler.

## App-owned surfaces

- `src/site-content.mjs` owns public site documents, deterministic local search, citations, freshness metadata, assistant identity, and refusal policy source data.
- `src/agent-user.mjs` builds the Edgekit grounded Q&A Skill/Profile, registers `searchPublicSite`, creates cascade readiness, and labels the no-model answer path as Basic fallback.
- `src/main.js` mounts `@kevinmarmstrong/edgekit-ui/lite`, wires `<edge-cascade-wizard>`, telemetry events, strict grounding, and the fallback handler.
- `index.html` is the small public site and capability-mode surface.

## Run locally

```bash
cd demos/public-site-agent-user
npm install
npm test
npm run build
npm run dev
```

Open the Vite URL and try:

1. `What capability mode is this site using?`
2. `Who am I chatting with?`
3. `Are you from Ohio and building rockets with robots?`

The first two should answer from site evidence with citations. The third must refuse because the host-owned site evidence does not support those claims.

## Acceptance evidence

Automated runtime checks in `tests/public-site-agent-user.test.mjs` cover:

- Grounded profile uses `grounding: "strict"`, required `searchPublicSite`, and `toolChoice: "required"`.
- Browser-local capability can move the cascade controller to `local-ready` instead of staying in Basic mode.
- Capability mode and Basic fallback copy are user-visible.
- Basic fallback is labeled with `Fallback response (no model available)` and uses the same read-only site search evidence.
- Unsupported claims such as Ohio, robots, and rockets return `I do not know from this public site evidence.`
- Configured assistant identity answers come from host-owned identity evidence.
- Citation evidence is present for supported capability and grounding answers.

## Friction log

- `app-specific integration`: The tiny site uses an in-memory search index because this demo has no backend. This is appropriate app-owned integration and not a core gap.
- `docs/onboarding gap`: None found while wiring published `@kevinmarmstrong/*` packages; `@kevinmarmstrong/edgekit-ui` and `@kevinmarmstrong/edgekit-knowledge` READMEs had the necessary public-site hints.
- `missing primitive`: None found for this scaffold.
- `weak default`: The grounded Q&A profile defaults to `downloadPolicy: "never"`, while the product proof wants browser-local cascade setup to be visible. The demo keeps the profile conservative but wires a separate cascade readiness controller with `downloadPolicy: "prompt"`; if more demos repeat this split, file a core feedback issue with browser evidence.
- `core bug`: None found in local runtime tests. Browser smoke showed a non-blocking `edge-cascade-wizard` Lit dev-mode `change-in-update` warning from the published UI component; file against core if it reproduces outside dev-mode smoke checks.
- `eval/test gap`: Root `npm test` now includes a scaffold check for this demo so catalog/source regressions are caught.

## Browser QA evidence

Clean-worktree QA was run from `feat/public-site-agent-user` on `http://127.0.0.1:5173/`.

- Chrome/browser navigation loaded the Vite demo with HTTP 200 and rendered the public site, capability-mode card, `<edge-cascade-wizard>`, configured assistant identity, Edgekit chat UI, strict-grounding copy, Basic fallback copy, and evidence summary.
- Runtime snapshot in this QA browser reported `window.ai.languageModel` unavailable and both Chrome AI and WebLLM providers unavailable, so the visible mode settled at `fallback-ready` / `Basic mode` with missing `local-model`. This blocks claiming `golden-pass` from this browser alone.
- Supported identity prompt `Who am I chatting with?` returned a labeled fallback answer grounded in `/#assistant-identity` and `/#grounding-policy` citations.
- Unsupported prompt `Are you from Ohio and building rockets with robots?` refused with `I do not know from this public site evidence.`
- Console had no JavaScript errors. Non-blocking dev warnings observed: Lit dev-mode warning and an `edge-cascade-wizard` `change-in-update` warning.

## Current limitations

This is a local scaffold, not a deployed live site. The clean browser QA run verifies UI, fallback honesty, grounded answers, refusal, and console state, but the available QA browser lacks a local model provider; a known local-model browser must still retest before promoting beyond browser-env-blocked evidence.
