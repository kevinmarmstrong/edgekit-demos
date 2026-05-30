const workarounds = [
  {
    title: 'Domain-specific dispatch selectors remain app-owned',
    classification: 'app-specific integration',
    evidence: 'The lab exposes readWorkOrder/listTechnicians because work-order shape, tenant-impact fields, and scheduling windows belong to the host dispatch board.',
    localWorkaround: 'Keep selectors in src/non-agent-app.mjs and expose only narrow readers to the agent surface.',
  },
  {
    title: 'Same-day maintenance approval is business policy',
    classification: 'app-specific integration',
    evidence: 'The risky mutation rule depends on occupied-building maintenance policy, not Edgekit core policy.',
    localWorkaround: 'The lab adapter requires an approvalId before host.actions.scheduleSameDayVisit mutates state.',
  },
  {
    title: 'Claim support is enforced by lab-local evidence IDs',
    classification: 'missing primitive',
    evidence: 'Edgekit provides tools, telemetry, and governance primitives, but this lab still needs local claim-to-tool-result evidence wiring to prove read-before-claim.',
    localWorkaround: 'runAgentUserWorkflow attaches tool-result event IDs to every workflow claim.',
    proposedCoreAcceptance: 'A reusable claim-support helper can assert that factual claims cite prior tool results before a response is surfaced.',
  },
  {
    title: 'Regression check for read-before-claim was added only in this lab',
    classification: 'eval/test gap',
    evidence: 'The lab test checks that readWorkOrder tool-result precedes claim telemetry; the shared demo catalog test does not yet enforce that across labs.',
    localWorkaround: 'test/retrofit-workflow.test.mjs includes the ordering check.',
    proposedCoreAcceptance: 'Add a reusable demo acceptance harness that verifies tool-call ordering, approval gates, and host-adapter-only mutations.',
  },
]

export function summarizeFriction() {
  return {
    workarounds: workarounds.map((item) => ({ ...item })),
    appSpecificIntegration: workarounds.filter((item) => item.classification === 'app-specific integration').map((item) => ({ ...item })),
    reusableEdgekitFriction: workarounds.filter((item) => ['missing primitive', 'eval/test gap'].includes(item.classification)).map((item) => ({ ...item })),
  }
}
