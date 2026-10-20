# API documentation

All HTTP APIs live under `apps/web/src/app/api/**` as App Router route handlers today (Next.js acts as the application backend for the delivered bounded contexts; they move into domain `services/` per PRD §9.1 as those contexts are delivered — see `docs/decisions/ADR-0010-monorepo-prd-alignment.md`).

## Conventions (established, tested)

- **Auth**: httpOnly `ops_session` cookie (SameSite=Lax). Anon → `401`. Missing permission (same tenant) → `403`. Other tenant's resource → `404` (no existence leak).
- **Tenant scope**: every tenant-owned read/write is scoped through a verified session tenant; cross-tenant FK ids in request bodies → generic `400` (IDOR prevention).
- **Authorization**: server-side permission engine (`src/lib/permissions`) is authoritative; UI filtering (`nav-config`) is navigation only (PRD §11).
- **Governed actions**: irreversible/privileged status changes are dedicated endpoints (e.g. `POST …/approve`), never generic `PATCH` transitions (ADR-0009).
- **Errors**: `{"error": "…"}`; login failures uniformly `401 Invalid credentials` (ADR-0003).
- **Audit**: governed/mutating security-relevant actions write audit events (incl. denials where specified).

## Endpoint inventory (as delivered)

| Endpoint | Methods |
| --- | --- |
| `/api/admin/audit-events` | GET |
| `/api/ats/candidates` | GET,POST |
| `/api/ats/candidates/[id]` | GET,PATCH |
| `/api/ats/interviews` | GET,POST |
| `/api/ats/interviews/[id]` | GET |
| `/api/ats/interviews/[id]/feedback` | POST |
| `/api/ats/interviews/[id]/outcome` | POST |
| `/api/ats/requisitions` | GET,POST |
| `/api/ats/requisitions/[id]` | GET,PATCH |
| `/api/ats/requisitions/[id]/approve` | POST |
| `/api/auth/forgot-password` | POST |
| `/api/auth/login` | POST |
| `/api/auth/logout` | POST |
| `/api/auth/reset-password` | POST |
| `/api/auth/sessions` | GET |
| `/api/auth/sessions/[id]` | DELETE |
| `/api/auth/tenant-selector` | POST |
| `/api/auth/verify-otp` | POST |
| `/api/authz/whoami` | GET |
| `/api/org/employees` | GET |
| `/api/org/employees/[id]` | GET,PATCH |
| `/api/org/my-team` | GET |

Regenerate with: `find apps/web/src/app/api -name route.ts`.

Contract target: PRD §10 (REST, JSON, OpenAPI in packages/api-contracts as it grows). Per-feature negative-test matrices live in `features/*/security.md` and `features/*/bugs.md`.
