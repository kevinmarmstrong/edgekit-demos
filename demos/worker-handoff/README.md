Audience: demo-team

# Worker Handoff Golden Demo

This browser-facing scaffold proves the `worker-handoff` golden demo path: an Edgekit agent user starts in visible browser-local capability, completes a bounded app task from host-app state, reviews a bounded handoff envelope, and escalates only when an app-owned Worker route is explicitly authorized. The Worker route receives bounded context, enforces policy, emits telemetry, and records audit evidence.

It intentionally uses only published runtime packages:

- `@kevinmarmstrong/edgekit@^0.3.2`
- `@kevinmarmstrong/edgekit-agui@^0.3.2`
- `@kevinmarmstrong/edgekit-governance@^0.3.2`

## Browser-facing proof

Run the browser proof locally:

```bash
PATH=/opt/homebrew/bin:$PATH npm run serve
# open http://127.0.0.1:4173/
```

The page renders three reviewable surfaces:

1. `data-testid="local-browser-step"` shows `summarizeVisibleDashboard` reading visible host-app state before any server request.
2. `data-testid="handoff-envelope-review"` shows the bounded envelope and excluded secret keys before/after server execution.
3. `data-testid="server-result"` shows the app-owned Worker route result, policy outcome, telemetry, and audit entries.

The route refuses execution unless the browser sends explicit app-owned authority (`x-edgekit-app-authority: worker-handoff-demo`) and completed local-browser tool proof. This keeps Basic/search-only/chat-shell behavior from being counted as success.

## User-facing mode

The demo has two paths:

1. `local-browser` for bounded tasks over visible host-app state, such as summarizing alerts on the current dashboard.
2. `app-owned-worker` when the request needs server-only capability, such as generating a finance warehouse billing variance report.

The handoff response explicitly tells the user why escalation happened instead of pretending Basic fallback is the product path.

## Bounded handoff context

`boundedHandoffContext()` constructs an Edgekit handoff envelope with `createHandoffEnvelope()` from `@kevinmarmstrong/edgekit-agui`.

Included context is intentionally small:

- safe identity: demo user id, role, and report permissions
- safe app state: workspace id, current view, selected quarter, visible alerts
- selected memory: one policy note
- server route tools: names and descriptions only

Excluded context is recorded in telemetry and tests:

- `authToken`
- `apiKey`
- `secretNotes`
- `rawCustomerEmail`

The local test fails if any excluded secret appears in the envelope. Prompt-provided PII/secrets are also redacted before the envelope is created, so user request text cannot bypass the boundary by being copied into `input` or `messages`.

## App-owned Worker route

The scaffold models `/api/edgekit/worker-handoff` as an app-owned Worker route. The Worker route owns the server-only `generateBillingVarianceReport` tool and executes it through `createToolPolicyExecutor()` from `@kevinmarmstrong/edgekit-governance`.

The policy allows only the report tool and bounds input, output, and timeout. The tool result records an audit entry through `createAuditTrail()`.

## Telemetry evidence

The run emits mode and outcome events:

- `mode.detected`
- `local_tool.outcome`
- `local_tool.proof_received`
- `handoff.context_bounded`
- `mode.transition`
- `tool.outcome`
- `server_route.completed`

These events show the user-visible transition from `local-browser` to `app-owned-worker` and the policy outcome.

## Acceptance evidence

Run from this directory after installing dependencies:

```bash
PATH=/opt/homebrew/bin:$PATH npm install --include=dev
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run demo
PATH=/opt/homebrew/bin:$PATH npm run serve
```

Repo-level static checks also validate that the catalog points at this scaffold and that the implementation uses the published Edgekit handoff, policy, redaction, and audit APIs:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/check-worker-handoff-demo.mjs
```

Catalog acceptance mapping:

- Browser-first cascade is visible before handoff: `browser cascade view model makes local-browser tool use visible before worker escalation` and `browser assets expose visible local-first cascade and app-owned route contract` tests.
- Local/browser mode handles bounded app tasks: `handles bounded app tasks locally` test.
- App-owned Worker handles server capability tasks: `escalates server-only tasks to app-owned Worker route` and `app-owned Worker route returns sanitized envelope, telemetry, and audit after local browser proof` tests.
- Server action requires explicit app-owned authority: `app-owned Worker route rejects handoff without explicit app authority and local proof` test.
- User sees why escalation happened: `userFacingMode` assertions.
- Handoff context is bounded and excludes secrets: `does not leak secrets into bounded handoff context` test.
- Telemetry records local step, mode transition, and outcome: `records mode transition telemetry and policy outcome` test.

## Friction log

- Classification: `app-specific integration`
- Finding: the task classifier, sample finance state, and `generateBillingVarianceReport` Worker tool are demo-specific host-app integration choices and should remain in this scaffold.
- No core issue was opened from this implementation because the published packages already expose the needed primitives: `createHandoffEnvelope`, `createToolPolicyExecutor`, `createPiiRedactor`, and `createAuditTrail`.

## EDGEKIT-LOOP metadata
<!-- EDGEKIT-LOOP: swarm5 | worker-handoff | 2026-05-29 | transactional-completion-extension | boundary-guard: explicit-handoff + mutation | local-proposal-first -->

## Transactional extension
Extended the demo to support real transactional workflow:
- Local/browser path: data gathering, validation, proposal
- Explicit mode disclosure and handoff request
- Worker completes the outcome with mutation/audit
- Full telemetry across boundary
- Browser QA exercised
- No core boundary leakage

