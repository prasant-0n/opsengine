# Threat model (living summary)

Scope: delivered contexts — root authentication (features #1), authorization (feature #2), dashboard shell (#3), HRMS core (#4), ATS recruitment (#5). Derived from PRD § security sections and the feature security docs; expand per feature as contexts land.

## Assets

- Tenant isolation boundary: all tenant-owned rows/files/jobs/events/reports carry `tenant_id`.
- Credentials: user passwords (scrypt N=2^17 — ADR-0004), OTP codes (SHA-256 hashed — ADR-0002), reset tokens (short-lived, single-use), session tokens (DB-backed, httpOnly cookie).
- Audit trail: audit events must remain attributable (governed actions incl. denial logging — ADR-0009).
- Email delivery (AWS SES — binding choice in `docs/decisions/custom-requests.md`).

## Trust boundaries

Browser → Next.js route handlers (same origin) → PostgreSQL (Prisma). No cross-service calls exist yet (§8.4: contexts coupled until services are delivered). AI surfaces: none yet (future: controlled interface over existing authorized workflows, never self-approving).

## Threats and controls

| Threat | Control | Evidence |
| --- | --- | --- |
| Domain enumeration on login | Uniform `401 Invalid credentials` (ADR-0003) | unit tests + smoke |
| OTP brute force / cross-tenant OTP | challengeId binding (ADR-0001), hashed codes (ADR-0002), per-IP rate limit (ADR-0005) | feature #1/#2 tests |
| Password offline cracking | scrypt memory-hard KDF (ADR-0004), maxmem ≥128MB (BUG-001) | unit tests |
| Session theft / CSRF | httpOnly + SameSite=Lax cookie; server-side session revocation (sessions API) | security stage docs #1/#2 |
| Cross-tenant read/write (IDOR) | Verified session tenant scoping; FK ids validated to caller tenant → generic `400`; cross-tenant target → `404` | negative-test matrices (smoke2: FK IDOR ×4, cross-tenant 404, anon 401) |
| Privilege escalation via UI | Server-side permission engine authoritative; nav filtering is navigation only (PRD §11) | same-tenant 403 matrix, authz unit tests |
| Approval bypass / unaudited governance | Governed endpoints, PATCH rejects governed statuses (ADR-0009) | smoke: PATCH bypass = 400; approve writes history + audit |
| Bulk assignment conflict of duty | SOD rules in permissions engine | authz unit tests |
| Secrets in repo | `.env` git-ignored, `.env.example` committed; no secrets in code | repo layout |

## Accepted risks / pre-production only

- In-memory rate limiter: no cross-replica coordination (ADR-0005) — swap to shared store before production.
- Web app currently talks to PostgreSQL directly via Prisma; becomes service-owned data access per PRD §9 as contexts split (ADR-0010).

## Update rule

Every feature's `security.md` (stage 6) must extend this table or explicitly state "no new threats".
