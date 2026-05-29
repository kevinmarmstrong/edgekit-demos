Audience: demo-team

# Worker Handoff Golden Demo

This local scaffold proves the `worker-handoff` golden demo path: an Edgekit agent user starts in browser-local capability, detects that a request is beyond local/basic capability, and escalates to an app-owned Worker route with bounded context, policy enforcement, telemetry, and audit.

It intentionally uses only published runtime packages:

- `@kevinmarmstrong/edgekit@^0.3.2`
- `@kevinmarmstrong/edgekit-agui@^0.3.2`
- `@kevinmarmstrong/edgekit-governance@^0.3.2`

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
```

Repo-level static checks also validate that the catalog points at this scaffold and that the implementation uses the published Edgekit handoff, policy, redaction, and audit APIs:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/check-worker-handoff-demo.mjs
```

Catalog acceptance mapping:

- Local/browser mode handles bounded app tasks: `handles bounded app tasks locally` test.
- App-owned Worker handles server capability tasks: `escalates server-only tasks to app-owned Worker route` test.
- User sees why escalation happened: `userFacingMode` assertions.
- Handoff context is bounded and excludes secrets: `does not leak secrets into bounded handoff context` test.
- Telemetry records mode transition and outcome: `records mode transition telemetry and policy outcome` test.

## Friction log

- Classification: `app-specific integration`
- Finding: the task classifier, sample finance state, and `generateBillingVarianceReport` Worker tool are demo-specific host-app integration choices and should remain in this scaffold.
- No core issue was opened from this implementation because the published packages already expose the needed primitives: `createHandoffEnvelope`, `createToolPolicyExecutor`, `createPiiRedactor`, and `createAuditTrail`.
