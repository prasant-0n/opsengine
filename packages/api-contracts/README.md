# packages/api-contracts

Shared API contracts (DTOs, error envelopes, session/tenant shapes) between `apps/web` and services — PRD §9.1 `packages/api-contracts`.

- Import as `@opsengine/api-contracts` (workspace).
- Renamed from `packages/api-contracts` during the PRD §9 restructure (ADR-0010).
- Rule (PRD §9.4): shared packages hold contracts and generic utilities only — no domain entities, no business logic, no `utils.ts` dumping ground.
