# services/identity-service

Implemented — NestJS-style layered service (PRD §9.2 shape: `prisma/`, `src/{use-cases,repositories,lib,middleware}`) owning **authentication, sessions, OTP flows, and currently also tenant control-plane / auth-root concerns** (tenant onboarding + tenant selection), coupled deliberately per PRD §8.4 ("deploy the most coupled bounded contexts together"). Split into `tenant-control-plane-service` when that context is delivered.

- Runtime today: schema + migrations + domain logic (`src/use-cases`) consumed by the web app's route handlers via `@opsengine/api-contracts`; the Prisma schema here is the single source for all delivered tenant-owned data.
- Commands: `npx prisma migrate deploy`, `npx prisma generate` (see `docs/runbooks/README.md`).
- Renamed from `identity-service` during the PRD §9 restructure (ADR-0010).

Deliberately **not** scaffolded as a standalone deployable yet — extracting HTTP/service boundaries happens context-by-context with its tests (PRD §8.4 guardrail).
