Audience: demo-team

# Tool Surface Retrofit Lab

This lab starts from a realistic non-agent maintenance dispatch board and adds the smallest app-owned helper/tool/state surface needed for a governed Edgekit agent user to complete a workflow.

The proof is not chat or RAG. The agent user must read host app state before making claims, mutate only through host-owned action adapters, request approval for risky same-day dispatch, and leave telemetry/audit evidence.

## Workflow

Operator prompt: “Handle the water leak at East Lofts today.”

Expected outcome:

1. Read the work order through `readWorkOrder` before claiming urgency, location, tenant impact, or required skill.
2. Read technician availability through `listTechnicians` before recommending assignment.
3. Request approval because same-day scheduling for an occupied building is a risky mutation.
4. If approved, schedule through the host app action adapter `host.actions.scheduleSameDayVisit`.
5. Emit telemetry and audit events for tool calls, claims, approval, mutation, and outcome.

## Local checks

```bash
npm install
npm test
npm run check
```

This lab depends only on published Edgekit packages:

- `@kevinmarmstrong/edgekit` `^0.3.2`
- `@kevinmarmstrong/edgekit-governance` `^0.3.2`

## Acceptance evidence

See `ACCEPTANCE.md` for the command output and mapping from acceptance criteria to implementation evidence.

## Friction classification

See `FRICTION.md` and `src/friction.mjs` for the required classification of every workaround as app-specific integration vs reusable Edgekit friction.
