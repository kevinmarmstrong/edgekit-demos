Audience: demo-team

# Labs

Labs are rough experiments for product discovery.

Labs may use throwaway code and local patches, but every patch must be
classified before it can influence core. A lab graduates to a golden demo only
when it proves a reusable app-operability outcome with published packages.

## Implemented Labs

- Existing-app tool surface retrofit: implemented in
  `labs/tool-surface-retrofit-lab` with a maintenance dispatch board, host-owned
  read/action adapters, approval-gated same-day scheduling, telemetry/audit, and
  classified friction. It remains a lab until browser QA and a golden-demo
  graduation plan prove the workflow in an interactive app surface.

## Current Lab Backlog

- Cascade runtime onboarding and user-triggered mode changes: scaffolded in
  `labs/cascade-runtime-onboarding-lab` with browser-local detection, WebLLM
  download consent, app-owned cloud/server fallback, Basic fallback labeling,
  retry/change controls, telemetry, audit, and classified friction.
- Worker/server handoff from browser-local mode.
- Evidence relevance and claim-support gating for public Q&A.
- Approval UX for multi-step workflows.
