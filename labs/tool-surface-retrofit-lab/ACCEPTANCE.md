Audience: demo-team

# Tool Surface Retrofit Lab Acceptance Evidence

## App shape

The lab begins with a non-agent maintenance dispatch board in `src/non-agent-app.mjs`:

- host-owned work-order state
- host-owned technician availability state
- host selectors: `listOpenWorkOrders`, `getWorkOrder`, `listTechnicians`
- host mutation adapter: `host.actions.scheduleSameDayVisit`
- host audit log for mutation evidence

The retrofit layer in `src/tool-surface.mjs` adds only the app-owned tool surface needed for one governed workflow:

- `readWorkOrder`
- `listTechnicians`
- `scheduleSameDayVisit`

## Acceptance evidence

Command: `npm --prefix labs/tool-surface-retrofit-lab run check`

Observed output:

```text
✔ agent workflow reads app state before making workflow claims
✔ risky same-day scheduling is approval gated and denial prevents mutation
✔ approved mutation goes through host-owned action adapter and writes audit/telemetry
✔ friction summary classifies every workaround and separates reusable Edgekit friction
{
  "lab": "tool-surface-retrofit-lab",
  "workflowStatus": "completed",
  "assignedTechnician": "TECH-PLUMBING-1",
  "telemetryEvents": 11,
  "auditEntries": 8,
  "hostMutations": 1,
  "reusableFriction": [
    "Claim support is enforced by lab-local evidence IDs",
    "Regression check for read-before-claim was added only in this lab"
  ]
}
```

## Package versions

From `npm ls @kevinmarmstrong/edgekit @kevinmarmstrong/edgekit-governance --depth=0`:

```text
@kevinmarmstrong/edgekit@0.3.2
@kevinmarmstrong/edgekit-governance@0.3.2
```

## Acceptance mapping

- Read before claim: `runAgentUserWorkflow` records `tool-result:readWorkOrder:*` evidence IDs on each workflow claim; the ordering test asserts the first read result precedes the first claim event.
- Mutation through host adapter only: the only host mutation in the happy path is `host.actions.scheduleSameDayVisit`; tests assert the host audit adapters list equals that adapter.
- Risky mutation approval: denial returns `blocked-by-approval` and leaves work-order assignment unchanged; approval creates an `approvalId` passed into the host action.
- Telemetry/audit: the surface records tool-call, tool-result, claim, approval-request, approval-decision, and mutation outcome telemetry; Edgekit governance audit entries are recorded for tool, approval, and error events.
- Friction classification: `src/friction.mjs` separates `app-specific integration` from reusable `missing primitive` and `eval/test gap` findings.
