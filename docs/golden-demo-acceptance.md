Audience: demo-team

# Golden Demo Acceptance

Golden demos prove app-operability, not chat presence.

## Required Outcome Checks

Every golden demo must answer yes to these:

- Can the agent user complete a real workflow a human user can perform?
- Are app APIs/helpers/tools the only way mutations happen?
- Does the host app remain the source of truth for state and authority?
- Does the agent use read tools before making factual or workflow claims?
- Are risky mutations approval-gated?
- Does cascade attempt browser-local capability before fallback when available?
- Does the user understand the current capability mode?
- Can the user or app trigger a capability/cascade change later?
- Are telemetry/audit events emitted for mode, tool, approval, and outcome?
- Are unsupported claims refused rather than laundered through weak evidence?

## Anti-Patterns

- A chat box appears, but no app workflow is completed.
- A no-model fallback is treated as the product experience.
- Demo code bypasses host app authority to make the scripted path pass.
- A prompt-specific formatter hides a missing primitive.
- Search results are treated as evidence without claim support.
- Core changes cite only one demo prompt and no reusable production friction.

## Evidence To Capture

- Package versions.
- Fresh install commands.
- Browser/provider mode.
- Prompt/task transcript.
- Tool calls and outputs.
- Approval request/decision.
- App state before and after.
- Telemetry/audit events.
- Failure screenshots or logs.
