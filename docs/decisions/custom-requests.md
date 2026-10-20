# Custom Requests & Decisions Log

Log feature-specific decisions, tooling choices, and open questions here. Update after every implementation session.

## Pending Decisions (ask user)
- [ ] Deployment target: Docker Compose local first, then what for staging/prod?
- [ ] Tenant database strategy: shared schema vs separate schema per tenant?
- [ ] CI provider: GitHub Actions or other?

## Decisions Made
- Mailing system: AWS SES (for OTP/verification emails)
- Auth provider: Custom auth (Next.js route handlers + PostgreSQL, no third-party auth provider)
- Password hashing: scrypt (Node.js built-in crypto — no native deps, turbopack-safe)
- Session storage: database-backed sessions (revocable, tenant-scoped, auditable)
- UI component library: shadcn/ui (Radix UI primitives, Tailwind CSS v4, clsx + tailwind-merge + cva)
- Monorepo root package name: opsengine
- Service layout: services/ + apps/web

## Rejected / Not Possible
- (none yet)

## Feature-Specific Notes
- (none yet)
