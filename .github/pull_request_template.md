## Description & Context
<!-- Provide a concise summary of the business rationale and PRD requirements addressed. -->

- **PRD Module Reference:** <!-- e.g., Module 12 (Finance) / §18.7 Line 1315 -->
- **Feature / Issue Number:** <!-- e.g., Feature #39 -->

---

## Architectural & Technical Changes
<!-- High-level architectural summary of modifications across database, service, and UI layers. -->

- [ ] **Data Model / Prisma:** Added/updated schema definitions and generated migration
- [ ] **ReBAC Authorization:** Scoped access controls (`tenant_id`, `account_id`, or `employee_id`)
- [ ] **API Surface:** REST endpoints with strict validation and error handling
- [ ] **Anti-IDOR Security:** Server-side isolation guards preventing cross-tenant access
- [ ] **UI Components:** High-contrast, responsive React 19 / Next.js 16 components

---

## Test & Evidence Summary
<!-- Summarize test suites executed and verification evidence. -->

- **Unit / ReBAC Tests:** <!-- e.g., 15 tests passed in apps/web/src/tests/expense-management.test.ts -->
- **Total Passing Tests:** <!-- e.g., 403 / 403 passing -->
- **Typecheck:** Clean compilation (`tsc --noEmit`, 0 errors across 6 packages)

```bash
# Verification command:
pnpm test
pnpm typecheck
```

---

## Security & Compliance Checklist
- [x] Every tenant-owned row is strictly scoped to `tenant_id`.
- [x] Negative cross-tenant authorization tests pass.
- [x] Server-side authorization is authoritative; UI checks are navigation only.
- [x] No secrets, private credentials, or live API keys committed.
- [x] 100% $0.00 / month recurring cloud infrastructure cost preserved.
