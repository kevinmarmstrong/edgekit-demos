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
