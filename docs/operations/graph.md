# Graph — Feature Connection Map

This file connects every feature's local documentation. Each feature lives in `features/<feature-name>/` with its own local md files covering Planning → Designing → Coding → Run → Bugs Fix → Security Fixes → Code Review → Approve.

## Feature Directory
| Feature | Path | Stage | Status |
|---|---|---|---|
| root-auth | features/root-auth/ | all stages | **APPROVED** 2026-10-19 |
| authz | features/authz/ | all stages | **APPROVED** 2026-10-19 |
| dashboard-shell | features/dashboard-shell/ | all stages | **APPROVED** 2026-10-19 |
| hrms-core | features/hrms-core/ | all stages | **APPROVED** 2026-10-19 |
| ats-recruitment | features/ats-recruitment/ | all stages | **APPROVED** 2026-10-19 |

## Dependencies (preliminary, from PRD)
- Auth & tenant onboarding → everything else depends on it
- Employee/HRMS core → projects, tickets, time reporting depend on it
- CRM core → projects, invoices depend on it
- Projects → tickets, resource allocation, time reporting depend on it
- Approval workflows → used by finance, recruitment, projects
- Finance → depends on CRM, projects, approvals
- Recruitment → depends on HRMS core, approvals
- AI interface → depends on auth, authorization, all workflows

## How to add a feature
1. Create `features/<feature-name>/`
2. Add local md files: `planning.md`, `design.md`, `coding.md`, `run.md`, `bugs.md`, `security.md`, `review.md`, `approve.md`
3. Add a row to the Feature Directory table above
4. Update `docs/architecture/service-catalog.md` if new components are introduced
5. Update `docs/architecture/architecture.md` if data/API boundaries change

## Cross-Cutting Concerns (apply to all features)
- `tenant_id` scoping on every tenant-owned row
- Server-side authorization (UI checks are navigation only)
- No arbitrary tenant-supplied executable JS as workflow config
- AI must not approve its own proposed actions
- Cross-tenant negative tests required

## Supporting Docs
- `docs/decisions/README.md` — Architecture Decision Records (document ambiguous requirement resolutions)
- `features/TEMPLATE.md` — template for each feature's local md files
