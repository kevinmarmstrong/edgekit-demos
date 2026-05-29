Audience: demo-team

# Edgekit Product Laws

These laws are the guardrail for all demos and labs.

## 1. Edgekit Makes Existing Apps Agent-Operable

The agent is a governed app user. It operates the host app through tools,
helpers, state readers, action adapters, and app-owned APIs. It does not own app
state and it does not replace the app.

## 2. Tool Use Is The Spine

Knowledge, chat, local models, and UI are supporting surfaces. The central
outcome is agentic tool use over app workflows a user can perform.

## 3. Cascade Is The Enabler

Cascade is not optional model configuration. It is the runtime capability and
onboarding mechanism that lets browser-local agents work in production without
support chaos. Basic/search-only mode is a fallback state, not the product.

## 4. The Host App Owns Authority

Identity, state, permissions, business rules, and mutations belong to the host
app. Edgekit bridges that authority into the agent runtime through explicit
contracts.

## 5. Risky Actions Must Be Visible

Important mutations require approvals, policy checks, telemetry, and audit.
Never bury a tool/action failure in generic assistant text.

## 6. Demos Discover Product Friction

A local workaround in a demo is not a product fix. Every workaround must be
classified and either kept app-specific or turned into a core issue/PR with
evidence.

## 7. Outcomes Beat Narrow Metrics

Bundle size, LOC, and no-model fallback quality matter only as constraints on
the outcome: enabling a useful governed agent user inside an existing app.
