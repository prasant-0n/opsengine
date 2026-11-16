# AGENTS.md

## Repository status
This repo is a fully bootstrapped monorepo with Turborepo, pnpm workspaces, Next.js 16 App Router, React 19, Prisma, PostgreSQL, Docker Compose, Vitest, and Playwright.
Features #1 through #37 are complete and verified with 363/363 passing unit tests and clean TypeScript compilation.
Current development state:
- Web app: Next.js 16 (`apps/web`), accessible on port 3000 locally or port 3002 via Docker.
- Database: PostgreSQL on port 5436 (Docker mapped `5436:5432`), schema synchronized via Prisma.
- Seed data: Seeded with multi-tenant showcase (`apps/web/scripts/seed.mjs`).
- Tests: `pnpm test` (Vitest, 35 suites, 363 tests) and `pnpm test:e2e` (Playwright).

## Binding rules from the PRD
- Do not silently invent business rules, bypass authorization, or claim a feature complete without tests and evidence.
- If a requirement is ambiguous, choose the safer configurable behaviour, document the assumption in an ADR, continue.
- Every tenant-owned row/file/job/event/report must be scoped to a verified tenant (`tenant_id`); cross-tenant negative tests pass.
- Server-side authorization is authoritative; UI permission checks are navigation only.
- Never use arbitrary tenant-supplied executable JavaScript as workflow configuration; keep workflow config as validated data.
- AI is a controlled interface to existing authorized workflows, not a separate authority system; AI must not approve its own proposed actions.

## Before coding anything
1. Inspect actual repository state first — do not assume installed tooling.
2. Propose a phase plan, dependency map, affected-file list, data-model/API changes, and test plan.
3. Work one bounded context and one vertical slice at a time (migration → DTO/API → use case → repository → authorization → tests → UI).
4. Run affected tests, then broader quality gates the environment supports.
5. Never state "tests pass" unless actually run and succeeded; never disable/skip/weaken an existing test to make a build green.
