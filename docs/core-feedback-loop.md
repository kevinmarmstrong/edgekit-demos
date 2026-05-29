Audience: demo-team

# Core Feedback Loop

Demo work becomes core work only when the friction generalizes.

## Keep In Demo

- Domain copy and sample data.
- App-specific API adapters.
- Styling and layout.
- Helper functions that exist only because the sample app is tiny.
- Scripted fixtures used only for demo storytelling.

## File Against Core

- Default install disables the agentic path.
- Cascade/readiness state is hidden, misleading, or not user-changeable.
- Tool use, approvals, identity, or state bridging require repeated boilerplate.
- No-model fallback can produce unsafe or unsupported claims.
- Published docs or agent skills guide installers toward non-agentic outcomes.
- Acceptance tests miss a failure that would affect multiple adopters.

## Issue Shape

Use this title format:

```text
[demo-friction] <demo id>: <short outcome failure>
```

Every issue must name the app-user outcome that failed.

## Core Issue Path

Use this path when the finding needs product, design, or API agreement before
code:

1. Copy `docs/friction-log-template.md`.
2. Fill in the demo repo, commit, package versions, environment, and transcript
   or logs.
3. Classify the friction.
4. Name the expected app-user outcome.
5. Propose the smallest reusable Edgekit change.
6. Propose an acceptance test that would fail before the fix and pass after it.
7. Open the issue in `kevinmarmstrong/edgekit`, not in the demo repo.

Suggested command:

```bash
gh issue create \
  --repo kevinmarmstrong/edgekit \
  --title "[demo-friction] <demo id>: <short outcome failure>" \
  --body-file <filled-friction-log.md>
```

## Core PR Path

Use this path only when the reusable fix is clear and testable:

1. Create a branch in `kevinmarmstrong/edgekit`.
2. Add or update a failing test/eval that captures the demo friction.
3. Implement the smallest core/sibling/docs change that fixes the reusable gap.
4. Keep demo-specific copy, data, and business logic out of core.
5. Run the relevant Edgekit checks.
6. Link the demo repo commit and transcript in the PR body.

The PR must explain why the change generalizes beyond one demo.

## Demo Repo Follow-Up

After a core issue or PR is opened, update the demo handoff with the core link
and keep any local workaround clearly labeled as temporary.
