# Decision log index

Every ambiguous-requirement resolution and architectural assumption is recorded here, per the PRD binding rules.

## ADR format

```
## ADR-00XX: <title>
**Date:** YYYY-MM-DD
**Status:** Proposed / Accepted / Superseded
**Context:** What prompted the decision
**Decision:** What was chosen
**Rationale:** Why, including the safer-configurable-behaviour choice if ambiguous
**Consequences:** Impact on other features, tests, or architecture
```

**Rule:** Never silently invent a business rule. If ambiguous, pick the safer configurable behaviour, record it here, then continue.

## Index

| ADR | Title | File |
| --- | --- | --- |
| ADR-0001 | OTP verification uses challengeId binding | `ADR-0001-otp-verification-uses-challengeid-binding.md` |
| ADR-0002 | OTP codes hashed at rest | `ADR-0002-otp-codes-hashed-at-rest.md` |
| ADR-0003 | Uniform login error responses | `ADR-0003-uniform-login-error-responses.md` |
| ADR-0004 | scrypt parameters (N=2^17, r=8, p=1, 256MB maxmem) | `ADR-0004-scrypt-parameters.md` |
| ADR-0005 | In-memory rate limiter (dev) with swap-out contract | `ADR-0005-in-memory-rate-limiter.md` |
| ADR-0006 | Reset-token consumption deferred to authz feature | `ADR-0006-reset-token-consumption-deferred.md` |
| ADR-0007 | (lives in `features/authz/planning.md`) | — |
| ADR-0008 | (lives in feature planning docs) | — |
| ADR-0009 | Requisition approval is a governed endpoint, not a PATCH transition | `ADR-0009-requisition-approval-governed-endpoint.md` |
| ADR-0010 | Monorepo alignment to PRD §9 code organization | `ADR-0010-monorepo-prd-alignment.md` |

Other inputs: `custom-requests.md` (binding project-level choices: AWS SES, custom auth, scrypt, DB sessions, monorepo, Tailwind).

Note: feature stage docs written before the PRD §9 restructure (2026-10-19) may reference the former root files `docs/decisions/README.md`, `docs/architecture/architecture.md`, `docs/operations/task.md`, `docs/operations/graph.md`, `docs/decisions/custom-requests.md`, and the PRD by its original filename — those now live under this `docs/` tree (PRD at `docs/product/requirements.md`).
