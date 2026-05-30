Audience: demo-team

# Admin workflow browser QA evidence

Generated: 2026-05-30T03:00:09.093Z

## Provider decision

Chosen lane: deterministic model-backed local/browser acceptance harness. Chrome AI/LanguageModel was probed and unavailable in this headless browser, so Basic/search-only fallback was not counted.

- userAgent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- window.ai present: false
- window.ai language model present: false
- global LanguageModel present: true

## Browser proof

The harness opened the local enterprise admin demo in real headless Chrome and exercised:

1. Local/browser model selected and called `searchAccounts`.
2. It called `evaluateAdminChange` and surfaced RBAC/policy risk.
3. It called `requestAdminApproval` before mutation.
4. It posted completed local proof, explicit `x-edgekit-app-authority`, and approved approval record to the app-owned mutation route.
5. The app-owned route executed `executeApprovedAdminChange`, updated host-owned account state, and returned telemetry/audit.
6. Hidden account owner emails and internal risk notes did not render.

Evidence:

- local model provider: deterministic-local-browser-model
- local model capability: tool-calling-local-browser-harness
- tool call order: searchAccounts -> evaluateAdminChange -> requestAdminApproval -> executeApprovedAdminChange
- mutation plan after approval: Enterprise
- telemetry events: tool.call, policy.evaluated, approval.requested, mutation.executed, server_route.completed
- audit entries: 3
- secret leak checks: {"ownerEmailVisible":false,"secretNoteVisible":false,"serverHasSecretLeak":false}
- screenshot: qa-artifacts/2026-05-30/admin-workflow/admin-workflow-browser-qa.png
- raw evidence: qa-artifacts/2026-05-30/admin-workflow/evidence.json

## Product outcome

`admin-workflow` now has a repeatable local/browser demo lane proving account search, RBAC/policy evaluation, approval-gated risky mutation, host-owned execution, telemetry, and audit in a real browser. It remains browser-qa-pass rather than golden-pass until review/merge and retest from a clean integrated branch.
