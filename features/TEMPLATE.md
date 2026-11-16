# Feature Template

Copy this folder structure for each new feature:

```
features/<feature-name>/
  planning.md     # Scope, data model, API surface, tenant scoping, authorization rules
  design.md       # UI screens (Stitch), component breakdown, API contracts
  coding.md       # Migration → DTO/API → use case → repository → authorization → tests → UI
  run.md          # Local dev server, Docker Compose, migrations, smoke test results
  bugs.md         # Failures from run/tests and fixes
  security.md     # Cross-tenant IDOR, auth guards, input validation, secrets
  review.md       # Self-review against PRD binding rules
  approve.md      # Sign-off, move to next feature
```

## Stage Order (do not skip)
1. Planning → 2. Designing → 3. Coding → 4. Run → 5. Bugs Fix → 6. Security Fixes → 7. Code Review → 8. Approve

## Rules
- Update each md after every stage completion.
- Cross-tenant negative tests must pass for every tenant-owned feature.
- Server-side authorization is authoritative; UI checks are navigation only.
- If unclear, ask before proceeding. If not possible, say no.
- Never claim a feature complete without tests and evidence.

## Front Matter (add to top of each md)
```
feature: <name>
stage: planning|designing|coding|run|bugs|security|review|approve
status: in-progress|done|blocked
last-updated: YYYY-MM-DD
depends-on: <other features>
```
