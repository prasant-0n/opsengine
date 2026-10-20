# Enterprise Operations Platform — Product Requirements & Agentic Engineering Specification

**Document type:** Product Requirements Document (PRD) + Software Requirements Specification (SRS) + Architecture Brief  
**Status:** Draft v1.1 — SaaS-first tenant isolation and employee/team-hierarchy authorization clarified  
**Product category:** SaaS-first, multi-tenant CRM + HRMS + project/workforce operations platform  
**Primary audience:** Agentic coding agent, product owner, engineering lead, QA, DevOps, HR, Finance, Sales, and business leadership  
**Last reviewed:** 18 October 2026

> **Instruction to the coding agent:** Treat this file as the source of truth for product behaviour and architecture. Implement in the phases defined below; do not attempt to generate the entire platform in one pass. If a requirement is ambiguous, choose the safer configurable behaviour, document the assumption in an ADR, and continue. Do not silently invent business rules, bypass authorization, or claim a feature is complete without tests and evidence.

---

## 1. Executive Summary

Build a transparent, commercial-grade **multi-tenant SaaS business operating system** for software/services companies. Each customer organization is a tenant with its own users, employees, teams, reporting hierarchy, SBUs, clients, projects, policies, records, feature entitlements, and administrative settings. Tenants may share the application and infrastructure, but tenant data and access must be isolated by design. The platform combines capabilities commonly found across HRMS products such as Darwinbox with CRM, sales/presales, project portfolio management, resource allocation, ticketing, daily work reporting, approvals, finance operations, and executive visibility.

The system must answer these questions reliably:

- Who is accountable for a client, opportunity, project, feature, ticket, employee, approval, and business decision?
- What is every employee expected to work on today, what did they actually work on, and what evidence supports the reported progress?
- Which projects are in the pipeline, which are at risk, and what capacity is committed or still available?
- What is the current recruitment pipeline, interview schedule, document-verification status, onboarding status, probation status, and leave/attendance position?
- Which business decisions are waiting for approval, who is allowed to approve them, and what is their complete audit history?
- What revenue, receivables, delivery risk, utilization, hiring, attendance, and ticket metrics should each level of leadership see?

The platform must create one traceable workflow from **lead → opportunity → presales estimate/proposal → approved project → resource allocation → tickets/work → time and activity reports → milestone acceptance → invoice/receivable/payment reconciliation**. HR lifecycle workflows must connect to the organization directory without exposing private HR documents to users who merely have management visibility.

### 1.1 Product principles

1. **One source of truth per business domain.** Each bounded context owns its data and publishes events; other services do not read its database tables directly.
2. **Transparent, not indiscriminately public.** Operational metrics are visible to authorized leaders. Confidential HR, compensation, candidate, client-contract, and finance records remain field- and scope-protected.
3. **Configurable policy over hard-coded hierarchy.** Approval limits, reporting lines, leave rules, working hours, holidays, and workday calculations are configurable by tenant/SBU.
4. **Auditability by design.** High-impact business actions create immutable audit records containing actor, tenant, scope, timestamp, action, reason, and before/after references where appropriate.
5. **Human approval for consequential actions.** AI may summarize, recommend, prepare drafts, and flag anomalies. It must not autonomously approve hiring, leave exceptions, financial commitments, customer payment terms, production releases, or employment outcomes.
6. **Microservice boundaries follow business capability.** Do not create a separate service for every database table or CRUD resource. Each service must have an explicit owner, API contract, data boundary, and operational reason to deploy independently.
7. **SaaS-first, tenant-isolated.** Tenant identity must be resolved from a validated authenticated membership, not trusted from request payloads. Every request, job, event, query, file operation, export, and cache key must carry or derive tenant scope. Cross-tenant access is a critical security defect.
8. **Employee/team hierarchy is first-class authorization data.** Reporting lines, team memberships, SBU membership, project assignments, ownership, and delegated responsibilities must be modelled as relationships with effective dates. Policies use those relationships at request time.
9. **Build incrementally.** Use a pnpm monorepo, shared contracts, local Docker Compose, automated quality gates, and independently deployable services. Kubernetes is not a prerequisite for the first useful release.

## 2. Goals, Non-Goals, and Success Measures

### 2.1 Goals

- Provide role-aware dashboards for SBU Heads, Senior Leads, Leads, HR, Finance, Sales, Presales, Support, Developers, QA, DevOps, interns, and employees.
- Support employee check-in/check-out, workday calendar, daily plan, daily activity report, and leave management.
- Provide ticket/project visibility, assignment, prioritization, SLA tracking, delivery reports, and escalation.
- Cover CRM account/lead/opportunity management, presales estimation and proposal approvals, project pipeline, and commercial handover.
- Cover recruitment through probation and employee lifecycle management.
- Cover resource/capacity planning, internal assignments, utilization, and allocation approval.
- Support invoice/receivable records, customer payment status, commercial approval workflows, and finance reconciliation.
- Provide configurable workflow and approval routing with complete history.
- Provide leadership dashboards with live or near-real-time operational summaries.
- Deliver SaaS tenant onboarding/offboarding, tenant-specific configuration, plan/feature entitlements, usage limits, auditability, exports, backups, and deletion/retention workflows.
- Make business data exportable, traceable, tenant-isolated, and backed up.
- Give an agentic coding system explicit implementation phases, module acceptance criteria, architecture constraints, and a definition of done.

### 2.2 Non-goals for the first release

- Replacing a certified Indian statutory payroll/tax engine. Payroll calculation, statutory filing, PF/ESI/TDS calculations, and bank disbursement should be a later module or integration after legal/accounting review.
- Building a video-conferencing platform. Integrate calendar/meeting links when configured.
- Building a full double-entry accounting/ERP general ledger. Initial finance scope is commercial approvals, invoices/receivables, payment records, and reconciliation metadata.
- Allowing AI to make final employment, compensation, financial, or production-release decisions.
- Depending on paid AI APIs or a cloud-only development environment. Local development must work with open-source services; external integrations (including payment processing, email/SMS, SSO, and AI providers) must use adapters and remain optional. The application itself is being designed as a SaaS product; this does not require paid third-party dependencies for local development.
- Treating an SBU Head's “observe everything” permission as unlimited access to raw sensitive content. Use masked/aggregated views unless an explicit permission and legitimate business purpose allow record-level access.

### 2.3 Initial success measures

These are starting targets and must be reviewed with actual company size and operating policy:

- 100% of approval-sensitive changes have an actor, decision, timestamp, and audit trail.
- 100% of tenant-owned records are protected against cross-tenant access at the API and data-access layers.
- Daily check-in/out and activity reporting can be completed without duplicate manual entry for the same work item.
- A leader can identify overdue approvals, tickets, unallocated work, and at-risk projects from a dashboard without requesting a manual spreadsheet.
- Recruitment, onboarding, probation, leave, and attendance status are visible to authorized owners from one interface.
- No module is considered production-ready unless it has API validation, authorization tests, database migrations, error handling, logs, health checks, and automated tests.

## 3. Users, Organizational Model, and Role Design

### 3.1 Important modelling rule

**Job family, seniority, organizational position, and access role are different concepts.** Do not represent all of these with one enum such as `role = "SENIOR_LEAD"`.

An employee record should distinguish:

- `jobFamily`: engineering, QA, DevOps, presales, sales, support, HR, finance, operations, or other tenant-defined family.
- `seniority`: intern, junior, mid-level, senior, lead, senior lead, head, or tenant-defined grade.
- `organizationPosition`: SBU, department, team, manager, reporting line, and effective dates.
- `accessRoles`: explicit permissions granted to the user, scoped to tenant/SBU/team/project and valid dates.
- `employmentStatus`: candidate, preboarding, active, on-leave, notice-period, exited, or tenant-defined status.

A Senior QA Engineer and a Senior Developer may have similar seniority but different function-specific permissions. An HR user should not obtain finance permissions merely because both are “senior resources.”

### 3.2 Organizational roles and responsibilities

#### SBU Head

**Primary responsibility:** SBU-level business outcomes, portfolio health, commercial exceptions, resource strategy, and final business sign-off within configured limits.

Capabilities, subject to tenant policy:

- View SBU-wide dashboards for pipeline, delivery, capacity, attendance summaries, overdue tickets, utilization, recruitment progress, finance status, and pending approvals.
- Approve resource allocations that exceed a configured duration/cost/capacity threshold or affect multiple teams.
- Decide commercial exceptions such as discount, credit/payment terms, payment milestones, and scope/commercial deviations within delegated authority.
- Approve business acceptance for a production/live release only after required QA, security, change-management, and technical-release gates pass.
- Review strategic client and project escalations, portfolio risk, utilization, hiring priorities, and forecast variance.
- View employee-level information only when specifically authorized; sensitive compensation, candidate documents, medical/leave documents, and private HR case content require dedicated permission.

#### Senior Lead

**Primary responsibility:** management of leads, opportunities, portfolio/pipeline, high-impact client communication, feature scope, and cross-team delivery dependencies.

Capabilities:

- Manage assigned leads/accounts/opportunities and coach or oversee Leads.
- Own pipeline hygiene, stage updates, forecast review, and next-action tracking.
- Attend and document important client/business meetings.
- Approve feature scope or prioritization within configured budget/capacity bounds.
- Review project readiness, dependency risks, delivery health, and allocation proposals.
- Escalate decisions that exceed delegated authority to the SBU Head.

#### Lead

**Primary responsibility:** day-to-day team execution and resource coordination.

Capabilities:

- Plan work, assign resources, maintain sprint/iteration or delivery plans, and prioritize tickets within policy.
- Attend client meetings, record decisions/actions, and keep client/project status current.
- Review daily plans and daily activity reports for direct reports where configured.
- Monitor blocked work, missed estimates, ticket SLAs, leave coverage, and workload imbalance.
- Propose resource changes and feature scope changes; route approvals rather than bypass them.
- Approve routine operational actions only if a permission/policy explicitly grants the capability.

#### Senior resources and function specialists

Function examples include Developers, QA, DevOps, Presales, Sales, Support, HR, and Finance. “Senior resource” is a seniority label, not a universal permission role.

- Create/update function-owned records within assigned scope.
- Review work products where their function requires peer review.
- Estimate effort, report progress, raise risks, and participate in reviews.
- Do not approve their own request when segregation-of-duties policy forbids it.

#### Junior developers, junior resources, and interns

- See their own profile, attendance, assigned work, work plan, tickets, daily reports, leave balances, learning/induction tasks, and permitted team dashboards.
- Update their assigned work and submit activity/time records.
- Raise help requests and blockers.
- Cannot self-assign privileged roles, approve their own leave/time corrections, approve releases, or view confidential HR/finance records unless a separate explicit permission grants access.

#### HR

- Manage requisitions and recruitment workflow, interview panels/schedules, candidate stages, document verification, offers, onboarding, induction, probation reviews, employee lifecycle, holidays, leave policies, HR communications, and employee engagement activities.
- Access confidential candidate and employee files only according to HR permissions and case assignment.
- Cannot silently change attendance, leave, or employment records: corrections require reason codes and audit trails.

#### Finance

- Manage invoice drafts/records, receivables, due dates, incoming payment records, payment allocation, reconciliation status, and finance reports.
- Validate financial data and attach evidence.
- Commercial exceptions and customer payment/credit terms still follow the configured business approval matrix; finance data entry is not equivalent to business approval.
- Cannot erase finalized financial records. Corrections use reversal/adjustment records with reasons.

#### Sales, Presales, Support, QA, and DevOps

- Sales owns prospect/client relationship records, lead activity, opportunities, stage transitions, and forecast input.
- Presales owns discovery notes, scope assumptions, effort/cost estimation, risk notes, proposal drafts, and technical/commercial handover.
- Support owns support tickets, customer communication, triage, severity, SLA, and escalation within client scope.
- QA owns test evidence, defect status, release quality gates, and sign-off records.
- DevOps owns deployment/change records, environment readiness, incident signals, and technical rollout evidence.

### 3.3 Authorization requirements

Use **RBAC + ABAC + relationship-based scope checks**:

- RBAC answers: “Can this user perform this action at all?”
- ABAC answers: “Under what attributes/conditions is it permitted?”
- Relationship/scope checks answer: “Does this record belong to this tenant/SBU/team/project or report to this manager?”

Every protected request must validate the tenant, permission, object scope, and sensitive field-level permissions. Do not rely on front-end hiding. Do not rely on a user-supplied `tenantId`, `sbuId`, `employeeId`, or role claim without server-side validation.

Permission keys should be granular and consistent, for example:

- `crm.opportunity.read`, `crm.opportunity.update`, `crm.opportunity.approve_stage`
- `work.ticket.assign`, `work.ticket.transition`, `work.ticket.export`
- `hr.candidate.read_sensitive`, `hr.employee_document.verify`, `hr.leave.approve`
- `time.attendance.correct`, `time.report.read_team`
- `finance.invoice.create`, `finance.receivable.record_payment`, `finance.commercial_terms.approve`
- `release.business_signoff`, `release.technical_approve`

Support role templates, custom tenant roles, scope constraints, role assignment expiry, and separation-of-duties rules. A role may be scoped to one SBU or project rather than granted globally.

### 3.4 Required employee-, team-, and hierarchy-based authorization model

The authorization system MUST be designed around the relationship between a signed-in user, their tenant employee record, team memberships, reporting relationships, assigned scope, the resource being accessed, and the requested action. Do not implement authorization as a single `if (user.role === 'LEAD')` check.

Use a hybrid model:

- **RBAC (role-based access control):** establishes the actions a principal can potentially perform, such as `work.ticket.assign` or `hr.leave.approve`.
- **ABAC (attribute-based access control):** applies attributes and conditions such as tenant, SBU, department, sensitivity, employment status, project, resource state, approval amount, MFA status, and policy constraints.
- **ReBAC (relationship-based access control):** evaluates relationships such as `employee_is_self`, `manages_employee`, `member_of_team`, `leads_team`, `owns_opportunity`, `assigned_to_project`, `assigned_to_hr_case`, or `delegated_approver`.

#### 3.4.1 Authorization decision contract

Every protected operation must evaluate a server-side decision equivalent to:

`authorize(subject, action, resource, requestContext) -> allow | deny`

The decision must verify, in order:

1. The authenticated principal has an active membership in the selected tenant; the tenant context comes from the validated session/token and server-side membership lookup, not request-body input.
2. The principal has the required permission for the requested action.
3. The resource belongs to the same tenant. Missing, conflicting, or unverified tenant scope means deny.
4. The principal has an allowed relationship/scope to the resource (self, authorized team/access group, reporting tree, SBU, project, assigned case, or explicitly granted tenant scope).
5. ABAC conditions and separation-of-duties rules pass.
6. The requested fields are visible to this principal. A resource-level `read` permission must not reveal every field on the record.

Authorization is **deny-by-default**. An absent attribute, expired relationship, unresolved employee identity, stale hierarchy cache, or failed policy evaluation must not grant access. The UI may hide unavailable actions for usability, but API/domain services remain the security enforcement point.

#### 3.4.2 Core subject, resource, and relationship attributes

**Subject (authenticated employee context):**

- `tenantId`, `userId`, `employeeId`, membership status, employee status, and authentication assurance/MFA state.
- Active role grants and permission grants, each with scope and validity dates.
- Current and effective-dated SBU/department/team memberships, job family, grade/seniority, location, and cost centre where relevant.
- Direct manager and permitted reporting-tree relationships; organizational team memberships; named/static or rule-driven access-group memberships; project memberships; and temporary delegated responsibilities.

**Resource (the record being accessed):**

- `tenantId`, domain/resource type, resource ID, owning employee/team, SBU, project/client scope, classification/sensitivity, lifecycle state, and current version.
- Field-level classification for confidential attributes, for example salary, candidate evaluation, identity documents, medical/leave attachments, commercial terms, and payment evidence.

**Relationship graph (the authorization basis):**

- `employee -> tenant membership -> employee profile`.
- `employee -> team membership -> team -> parent team/SBU`.
- `employee -> access-group membership -> permission/visibility policy`; access groups can represent cross-functional working groups such as interview panels, incident responders, project squads, or finance reviewers without changing the formal org chart.
- `manager employee -> direct report employee`, with relationship type and effective dates.
- `employee -> project membership/assignment -> project`.
- `employee -> record ownership/assignment` for leads, opportunities, tickets, approvals, and HR cases.
- `employee -> access group membership` for explicitly granted cross-functional scopes; group membership is not a substitute for action-level policy.
- `delegator -> delegate` for time-bounded delegation, with explicit action and scope constraints.

An employee can belong to multiple teams and can have a primary team plus secondary/project teams. A team may contain many employees, and a team lead is an explicitly assigned responsibility—not an inference from seniority or membership. A reporting relationship may be direct, dotted-line, acting-manager, or project-specific; each type must have an explicit policy meaning. Reporting-tree traversal must include only relationship types allowed by the policy. A child team's scope is not automatically inherited by its parent or siblings unless a specific policy says so. Do not assume that any team member is automatically a manager, or that being a manager grants access to all sensitive fields.

#### 3.4.3 Required organizational entities and data rules

Model these as tenant-owned records or tenant-scoped identities:

- `TenantMembership`: user-to-tenant membership, employee link, status, tenant-local grants, and join/leave timestamps. A global login identity may belong to multiple tenants, but each active session/request must resolve one explicit tenant context.
- `Employee`: the HR master record for one person in one tenant. Keep authentication credentials in Identity; keep employment data in Core HR.
- `Team`: tenant-owned organizational team with optional parent team, team type, SBU/department, and effective dates.
- `EmployeeTeamMembership`: employee, team, membership type (primary, secondary, project, temporary), team responsibility (member, coordinator, team lead), `validFrom`, and `validTo`.
- `AccessGroup` / `AccessGroupMembership`: tenant-owned permission or collaboration group with an explicit purpose, membership source (manual or validated rule), effective dates, and audit history. Membership alone grants no access unless a policy explicitly maps the group to actions and scope.
- `ReportingRelationship`: manager employee, report employee, relationship type, scope, `validFrom`, and `validTo`; enforce no invalid cycles for relationships designated as the primary management chain.
- `RoleGrant` / `PermissionGrant`: principal, role or permission, scope type, scope ID, `validFrom`, `validTo`, grantor, reason, and audit reference.
- `ProjectMembership` / `ResourceAssignment`: explicit project/assignment relationship and dates.
- `PolicyVersion`: versioned and auditable rule set for action, scope, conditions, field visibility, and conflict-of-interest controls.

Use the effective relationship at the requested decision time—normally now for current access—rather than trusting a permanent `managerId` copied onto every resource. If a reporting line or team membership changes, current access must update promptly. Historical records and audit events must preserve who held which relationship at the time of the event.

#### 3.4.4 Default scope semantics

Implement these explicit scope types; never interpret an absent scope as global access:

- `SELF`: the employee's own permitted records.
- `TEAM`: records belonging to a specified team or teams explicitly assigned to the principal.
- `REPORTING_TREE`: permitted records for direct/indirect reports under a defined management relationship type.
- `SBU`: permitted records in a specified SBU.
- `PROJECT`: permitted records for assigned project memberships.
- `GROUP`: records/actions explicitly granted to a named access group; group membership must be active and tenant-scoped.
- `ASSIGNED_CASE`: a record explicitly assigned to the principal (for example, a recruitment case).
- `TENANT`: tenant-wide access only where a dedicated permission is explicitly granted; it does not automatically include sensitive fields.

Scope inheritance is not universal. A Senior Lead's reporting-tree visibility does not confer finance, salary, candidate-document, medical, or other sensitive access. HR privileges are not granted merely because an HR user manages a team. An SBU Head can receive tenant-policy-approved SBU-level operational dashboards, but raw sensitive records require separate, auditable permission.

#### 3.4.5 Minimum example policies

- An employee can read their own basic profile, attendance, leave balance, assigned tickets, and submitted daily activity reports. They cannot read another employee's private HR documents.
- A Lead can read permitted operational information for active team members and manage tickets within teams/projects they lead. They cannot access a different SBU's tickets solely because both teams belong to the same tenant.
- A Senior Lead can read operational summaries and permitted records for the Leads/reporting tree and portfolio scopes explicitly assigned to them. Team hierarchy alone does not expose salary, private HR cases, candidate documents, or bank/payment evidence.
- An SBU Head can view authorized SBU-level pipeline, project risk, utilization, ticket, attendance, recruitment, and receivables summaries. Sensitive detail access is a separate permission and must be audited.
- HR can view candidate or employee documents only with the relevant HR permission and tenant scope, plus case assignment or approved HR scope where configured.
- Finance can access financial records and customer payment evidence within assigned tenant/business scope, but cannot access candidate or medical documents through a broad `read` grant.
- A QA or DevOps approver must satisfy the release-specific technical permission and required gate policy. Business seniority cannot override a failed mandatory gate.
- A requester cannot approve their own request when the configured segregation-of-duties policy prohibits it, even if their organizational level would otherwise permit approval.

#### 3.4.6 Enforcement and performance

- Put authorization metadata in the validated request context using a server-side guard/interceptor and typed `AuthorizationContext`; never trust front-end-supplied role/team/manager arrays.
- Domain services must authorize each use case. Repository methods must require a `TenantScope` and, where relevant, an explicit `ResourceScope`/filter. Avoid generic repository methods that can accidentally query without a tenant predicate.
- Apply tenant filtering and permitted-resource filtering in the query itself, not only after fetching records. Enforce sensitive-field projection/redaction before DTO serialization.
- PostgreSQL Row-Level Security (RLS) may provide defense in depth for tenant isolation, but service authorization and query scoping remain mandatory.
- Cache effective team/reporting-tree membership only with tenant-qualified keys and reliable invalidation on organization changes. Fail closed when authorization-relevant cache state is unavailable or stale beyond the configured bound.
- Add negative tests for peer access, former-team access after transfer, expired delegation, cross-tenant IDs, sibling SBU access, sensitive-field leakage, manager relationship changes, team-lead changes, and self-approval.
- Provide an explainable policy decision trace for authorized administrators/auditors: policy version, matched scope/relationship, decision, and reason code. Never expose secrets or sensitive attributes in ordinary application logs.

## 4. Approval and Decision Matrix

The workflow/approval service must make approver routing configurable; the following is the default proposal, not an immutable code-level truth.

| Decision / action | Requester | First reviewer | Final approver | Mandatory controls |
|---|---|---|---|---|
| Routine ticket assignment | Lead or authorized assignee | Lead/team policy | Usually none | Audit status/assignee changes |
| Cross-team or extended resource allocation | Lead | Senior Lead | SBU Head if threshold/policy requires | Capacity and cost impact; no over-allocation without override |
| Feature scope change | Lead/Senior Lead | Senior Lead | SBU Head for cost, date, or contract impact above threshold | Versioned scope, estimate, risks, client approval evidence where required |
| Opportunity stage change | Sales/owner | Sales/Senior Lead policy | Senior Lead or SBU Head for configured stages | Required fields and next action before advancing |
| Commercial discount/payment terms | Sales/Presales | Finance validation | SBU Head or delegated commercial approver | Threshold matrix, reason, versioned quote, audit trail |
| Invoice issue / receivable | Finance | Finance reviewer if enabled | Designated approver based on amount/contract | Contract/milestone evidence; requester cannot self-approve where policy forbids |
| Incoming customer payment | Finance records receipt | Finance reconciliation | SBU Head for dispute, write-off, payment-plan exception | Preserve source transaction; never edit paid amount without adjustment/reversal |
| Leave request | Employee | Direct manager/Lead | HR or higher approver only when policy requires | Leave balance, overlap/coverage checks, policy calendar |
| Attendance correction | Employee/manager | Manager | HR for policy-sensitive corrections | Original punch retained; correction reason and audit record required |
| Candidate offer | Recruiter/HR | Hiring manager | Authorized compensation/offer approver | No AI-only selection; offer approval and document history |
| Production release | Release owner | QA + technical/DevOps checks | Designated release approver; business sign-off by SBU Head when required | All required gates must pass; SBU Head cannot bypass failed technical/security gates |
| Employee exit/termination action | Authorized HR | HR leadership/legal workflow as configured | Explicit designated authority | Sensitive restricted workflow, documented rationale, audit trail, human-only decision |

Rules:

1. A requester must not approve their own request where the configured separation-of-duties matrix prohibits it.
2. An approval is bound to the exact version of the item that was reviewed. Material changes invalidate prior approval and require re-approval.
3. Approval requests need `pending`, `approved`, `rejected`, `cancelled`, `expired`, and `superseded` states, plus a reason and action history.
4. Approver substitution/delegation must have start/end dates, explicit scope, and audit records.
5. Approval thresholds must be stored as tenant policy, not hard-coded amounts in controllers.
6. SLA timers and reminders must be configurable and visible to requesters and authorized leaders.

## 5. Functional Module Breakdown

### Module 0 — Tenant, Company, SBU, and Configuration Administration

**Purpose:** Configure the organization and the policy boundaries that every module uses.

Requirements:

- Support true multi-tenant production operation from the first release. Do not treat multi-tenancy as a later retrofit or only add `tenantId` columns without end-to-end enforcement.
- Manage tenant/company, SBUs, departments, teams, job families, locations, cost centres, project codes, reporting lines, holiday calendars, work schedules, and effective dates.
- Configure working hours, grace periods, workday rules, leave types, approval thresholds, attendance rules, ticket priorities, SLA calendars, currency, timezone, locale, date display preferences, retention policies, and allowed integrations per tenant.
- Support policy versioning with `effectiveFrom`, `effectiveTo`, creator, approver, and audit history.
- Provide a secure tenant setup wizard and validated seed/demo data. New tenants must have no access to another tenant's seeded or production data.
- Support tenant-level branding and domain configuration through safe validated settings; never let tenant configuration become executable code.

Acceptance criteria:

- An authorized platform operator can provision a tenant and its initial tenant administrator.
- A tenant administrator can create SBUs, teams, employees, and reporting relationships without code changes.
- Every tenant-owned row/file/job/event/report is scoped to a verified tenant; cross-tenant negative tests pass.
- Every identity is resolved to its tenant membership and, where applicable, its employee profile before employee/team-based policy evaluation.
- Formal organizational teams and cross-functional access groups are distinct, effective-dated relationships; both are covered by grant/revocation tests.
- Effective-dated team/reporting/policy history remains queryable for audit and historical calculations.

### Module 0A — SaaS Control Plane, Tenant Lifecycle, Plans, and Entitlements

**Purpose:** Operate the platform as a SaaS product for multiple independent customer organizations. Keep platform-level administration separate from each customer's tenant administration.

Requirements:

- **Tenant lifecycle:** provision, configure, activate, suspend, reactivate, schedule export, offboard, and close tenants through an audited lifecycle state machine. Define what happens to sessions, background jobs, integrations, files, retained records, and tenant domains at each transition.
- **Tenant bootstrap:** create the initial tenant administrator using a single-use, expiring invitation or equivalent secure flow. Never create tenants with a known default password.
- **Control-plane vs tenant-plane separation:** platform operators manage tenant lifecycle, plan catalogue, platform health, and support access; tenant administrators manage users, employees, hierarchy, settings, and tenant data. A platform operator must not automatically have unrestricted access to tenant business content.
- **Plan and feature entitlements:** model plan catalogue/version, tenant subscription, enabled feature flags, seat limits, storage/usage limits, status, trial dates where used, and effective dates. Check entitlements server-side in addition to UI gating. Entitlements must not grant business-data permissions.
- **Subscription lifecycle:** support trial, active, past-due, suspended, cancelled, and expired states as configurable business policy requires. Payment provider integration is behind a billing adapter and can be disabled for local development or manual invoicing. Do not couple core HR/attendance records to a payment vendor.
- **Keep two finance domains separate:** platform subscription billing (what a SaaS tenant pays the platform operator) belongs to the control plane; a tenant's own invoices and receivables for its clients belong to that tenant's Finance service. Their records, permissions, dashboards, webhooks, and APIs must never be mixed.
- **Usage metering:** record tenant-scoped usage events for billable/limited dimensions such as active seats, document storage, automation runs, and API consumption where enabled. Define idempotency and aggregation windows; do not derive invoices from unverified client-side counters.
- **Tenant administration:** user invitations, domain verification where enabled, admin transfer, tenant security settings, retention settings, exports, integration credentials, and tenant audit views.
- **Support access:** any exceptional support impersonation/session must be time-limited, reason-bound, explicitly authorized, prominently audited, and limited to the minimum scope. Support access must not be a hidden bypass of tenant authorization.
- **Data lifecycle:** define backup/restore, export formats, deletion requests, retention/legal-hold exceptions, and tenant closure. A tenant data export must be tenant-scoped, audited, encrypted where stored, and expire automatically.
- **Operational isolation:** queue messages, scheduled jobs, cache keys, rate limits, search indexes, object-store paths, webhooks, and report exports must carry verified tenant identity. One tenant's load or retry storm must not trivially starve every other tenant; establish quotas and backpressure for expensive workloads.
- **Configuration:** each tenant has timezone, locale, currency preferences, authentication policy, notification options, allowed integrations, and retention settings; global defaults may be overridden only through validated, versioned tenant settings.

Acceptance criteria:

- Two seeded tenants with similarly named employees, teams, projects, and record IDs cannot read, update, export, or infer each other's data.
- Tenant activation/suspension immediately affects new sessions and queued work according to documented policy.
- Features and quotas are enforced by server-side entitlement checks and covered by tests.
- Tenant export and closure flows produce audit evidence and honour retention policy.
- There is no universal support/operations token that grants implicit access to all tenant content.

### Module 1 — Identity, Authentication, Authorization, and Sessions

Requirements:

- Login/logout, secure session lifecycle, account invitation, account activation, password reset, email verification, session revocation, MFA for privileged roles, and optional OIDC/SSO integration.
- Access control using roles, permissions, scopes, resource ownership, and field-level restrictions.
- Account status handling for invited, active, locked, suspended, and deactivated accounts.
- Rate limiting, brute-force protection, suspicious-login events, and administrative session revocation.
- Record permission changes and privileged access grants in the audit log.
- Enforce least privilege and deny by default.

Security baseline:

- Do not store access tokens or refresh tokens in browser `localStorage`.
- Prefer secure, `HttpOnly`, `SameSite` cookies for browser sessions and use CSRF protections appropriate to the session design.
- Use short-lived access credentials, refresh-token rotation/reuse detection if refresh tokens are used, secure password hashing (Argon2id or an approved equivalent), and secret rotation.
- Keep passwords, tokens, document contents, and sensitive personal data out of logs.

### Module 2 — Employee Directory and Core HR

Requirements:

- Employee profile with employee ID, job family, grade/seniority, employment type, department, SBU, manager, location, start date, status, skills, and permitted emergency/contact information.
- Org chart and manager/reporting-line history.
- Employee lifecycle: preboarding, active, probation, notice period, exited, rehired if policy permits.
- Employment documents and HR letters through the document service with scoped access.
- Probation start/end dates, review tasks, reminders, manager feedback, HR review, extension/confirmation outcome, and history.
- Internal announcements and policy acknowledgements.
- Search and filters respecting field permissions. General managers must not automatically access compensation or private documents.

### Module 3 — Recruitment / Applicant Tracking (ATS)

Requirements:

- Workforce requisition with job title, job family, grade, headcount, budget band, SBU/team, hiring manager, justification, expected start date, and approval status.
- Recruitment stages configurable by tenant, with a useful default: applied → screening → recruiter discussion → technical round(s) → managerial round → HR round → offer → accepted/rejected/withdrawn.
- Candidate profiles, resume/document storage, source, consent/privacy notice metadata, notes, ratings, interview feedback, stage history, and duplicate detection.
- Interview panel assignment, availability, calendar invitation, time zone awareness, reschedule/cancellation, reminders, scorecards, and outcome capture.
- Recruitment notification templates, interviewer feedback reminders, and hiring funnel dashboards.
- Document verification checklist: requested, received, under review, verified, rejected, or exception pending. Keep the verifier, timestamp, reason, and evidence reference.
- Offer generation from approved templates, approval chain, acceptance status, and transition to preboarding.
- Interview and hiring decisions must be made by authorized humans. AI may summarize a resume or prepare interviewer questions but must not automatically reject a candidate.

### Module 4 — Onboarding, Induction, and Probation

Requirements:

- Convert an accepted candidate into a preboarding employee without duplicating identity/employee records.
- Configurable onboarding checklists by job family/location/employment type.
- Assign tasks to HR, IT/DevOps, manager, finance, and employee as applicable: documents, policies, account provisioning, device/access checklist, team introduction, and training.
- Track due dates, dependencies, evidence, task owner, blockers, reminders, and completion percentage.
- Induction schedule, orientation sessions, policy acknowledgement, mentor/buddy assignment, and attendance.
- Probation milestones, review form, manager/employee feedback, reminders, extension/confirmation workflow, and approval history.
- On exit: controlled offboarding checklist, access-revocation tasks, asset handover, knowledge-transfer record, exit interview, and document retention rules.

### Module 5 — Attendance, Check-in/Check-out, Workday Calendar, and Leave

Requirements:

- Employee check-in and check-out with server timestamp, configured timezone, source (web/mobile/admin correction/integration), and optional location/device metadata only where legally and operationally justified.
- Prevent duplicate active check-ins. Handle missed check-out and overnight shifts through a policy-driven flow, not arbitrary silent correction.
- Show daily status: not checked in, checked in, checked out, leave, holiday, weekend, absence pending review, and correction requested.
- Work schedule, weekly off, holidays, shift rules, grace periods, late mark/early departure, expected hours, actual hours, and overtime policy hooks.
- Leave types, accrual/configuration, balance ledger, requests, approval routing, cancellation, half-day/hourly leave if enabled, blackout dates, team calendar, and leave history.
- Leave overlap/coverage warnings. Do not let a manager change a leave balance without an adjustment record and reason.
- Attendance corrections must preserve original punches. Store correction as an additional record with the approver and reason.
- Workday calculation must use the policy effective on that date. Never recalculate historical records silently after a policy change.
- CSV import/export with validation, duplicate detection, and error report.

Calculation requirements:

- All date/time calculations use a defined tenant timezone and store canonical timestamps in UTC.
- Separate **scheduled hours**, **recorded attendance duration**, **approved leave duration**, **holiday/weekend rules**, and **billable project time**. Do not assume these are interchangeable.
- Rounding, grace time, break deductions, overtime, and partial-day rules must be tenant-configurable and versioned.
- Missing punches and anomalous hours create review tasks; they do not automatically become disciplinary decisions.

### Module 6 — Daily Work Plan and Daily Activity Report (DAR)

Requirements:

- Each workday, employees can declare the work they plan to do, with ticket/project reference, planned outcome, estimated effort, priority, and optional blockers.
- Employees can update actual progress, completed outcomes, work duration (if enabled), blockers, carry-forward items, and links/evidence.
- A daily report is generated from actual work-item updates and approved time entries where possible; employees can add narrative context without duplicating ticket data.
- Support check-in, plan submission, plan changes, end-of-day report, missed-report reminders, and manager review.
- Show planned vs actual work, completed/blocked/carried-forward tasks, unplanned work, and work item references.
- A manager can review direct reports. Senior Leads/SBU Heads receive aggregated status, risk trends, and overdue reporting metrics based on authorization.
- Do not treat keystrokes, screenshots, webcam monitoring, or invasive surveillance as a default productivity metric.
- Corrections to submitted historical DARs must be versioned and auditable.

### Module 7 — Ticketing, Support Desk, and Work Management

Requirements:

- Ticket types: bug, feature, task, incident, support request, operational request, and tenant-defined types.
- Fields: tenant, project/client scope, title, description, type, status, priority, severity, assignee, reporter, watchers, labels, estimate, due date, SLA policy, linked tickets, attachments, comments, acceptance criteria, and change history.
- Configurable workflows with validated transitions. For example: open → triaged → assigned → in progress → review/testing → blocked or resolved → closed/reopened.
- Queue/board/list/calendar views; assignment, re-assignment, bulk action with permission checks, filters, saved views, and ticket templates.
- Comment visibility levels: internal, customer-visible, and restricted. The API must prevent internal notes from leaking to clients.
- SLA clock with business calendars, pause conditions, breach prediction, notifications, escalation levels, and reporting.
- Track assignee history, due-date changes, priority changes, blockers, reopened count, resolution reason, and linked deployment/release when relevant.
- Daily and weekly reports: created/resolved/overdue/blocked tickets, SLA adherence, cycle time, lead time, reopened rate, workload by person/team, and severity distribution.
- Avoid using ticket count alone as an employee performance metric; dashboards must provide context and must not rank employees without approved policy.

### Module 8 — Project Portfolio, Delivery Pipeline, and Release Management

Requirements:

- Project record linked to customer/account, opportunity, approved proposal/statement of work, SBU, owner, delivery lead, start/end dates, status, budget, milestones, risk register, and resource plan.
- Project lifecycle: proposed → pending approval → approved → planned → active → at risk/on hold → completed/closed/cancelled.
- Portfolio pipeline with expected start date, confidence, dependencies, resource demand, commercial value, and decision history.
- Milestones, deliverables, scope versions, acceptance criteria, client sign-off records, and change requests.
- Release/change record with release owner, target environment, change window, linked work items, QA evidence, security status, rollback plan, deployment logs/link, smoke-test results, and approver trail.
- A production release cannot be marked approved if required technical, QA, security, or rollback gates are failed/missing.
- Business approval and technical approval are separate fields and separate permissions.
- Dashboards: schedule variance, budget/effort variance, milestone status, blocked work, risks, releases, client acceptance, and project health.

### Module 9 — CRM: Accounts, Leads, Opportunities, and Client Relationships

Requirements:

- Account/company records, contacts, account owner, SBU, industry, source, status, client tier, contract references, engagement history, and permitted contact data.
- Lead capture, qualification, assignment, deduplication, source attribution, next action, reminder, and conversion to account/contact/opportunity.
- Opportunity pipeline with configurable stages, amount/currency, expected close date, probability, forecast category, owner, competing solution if recorded, risks, next action, and stage history.
- Activities: calls, emails, meetings, notes, action items, attachments, and follow-up date. Do not claim an email/call occurred unless an integration or explicit user action records it.
- Contact/account relationship history and stakeholder map.
- Lost/won reason, competitor notes if applicable, and audit history.
- Forecast views by SBU, owner, stage, close period, and confidence. Forecast computations must be documented and consistent.
- Access to client records is tenant- and scope-limited. Sensitive contract/payment details require dedicated permissions.

### Module 10 — Presales, Estimation, Proposal, and Commercial Handover

Requirements:

- Discovery requirements, assumptions, exclusions, non-functional requirements, acceptance criteria, risk/dependency list, and client confirmation.
- Estimation by role/skill, effort, rate card, delivery phase, contingency, duration, environment/dependency assumptions, and estimated gross margin where policy permits.
- Versioned estimate/proposal with owner, reviewers, validity period, commercial model (fixed price/time-and-materials/retainer or tenant-defined), milestones, currency, payment schedule, discount, and terms.
- Approval workflows for non-standard discounts, margin thresholds, payment/credit terms, scope deviations, and contractual exceptions.
- Proposal status, expiry reminders, send/share record, outcome, and conversion to approved project without copy/paste recreation.
- Handover checklist to delivery: signed scope, assumptions, delivery milestones, client contacts, accepted commercial terms, risks, and approved resource expectations.
- Presales estimates must be visible to delivery and finance only according to permission policy. Rate cards and margins are confidential.

### Module 11 — Resource and Capacity Planning

Requirements:

- Skills, proficiency levels, availability, employment allocation, project assignments, planned leave, working calendar, and utilization definitions.
- Allocation request with employee/skill, project, percentage/hours, start/end dates, estimated cost if permitted, current commitments, and business justification.
- Detect over-allocation, conflicting project dates, leave conflict, missing skill coverage, and allocation beyond configured working capacity.
- Support allocation proposals, approvals, start/end, change history, and release from project.
- Compare demand vs capacity by week/month/SBU/skill, future bench capacity, unstaffed demand, and forecasted utilization.
- Separate planned utilization, actual recorded project hours, billable utilization, and attendance hours.
- Interns/junior staff allocation can require mentor assignment and policy-defined supervision.
- Managers can see their scope; SBU Heads can see SBU-level summaries and approved drill-downs.

### Module 12 — Finance Operations: Commercials, Invoices, Receivables, and Payment Decisions

Requirements:

- Client commercial profile, approved quote/contract references, currency, billing model, payment terms, billing milestones, invoice draft, invoice issued status, due date, amount, tax metadata, adjustments/credit-note references, receivables, dispute status, and payment records.
- Link invoice to a project/milestone/contract and store evidence of acceptance where required.
- Finance can record partial payments, payment references, date received, allocation to invoice, unallocated cash, reconciliation status, overdue days, and follow-up owner.
- Commercial approval for payment terms/credit/discount/write-off follows authority thresholds; Finance validation and SBU Head business approval must be separate actions when policy says so.
- Use append-only payment/adjustment history; finalized values cannot be silently overwritten.
- Reminders for upcoming/overdue invoices, client disputes, promised payment dates, and unallocated receipts.
- Reports: issued/paid/outstanding invoices, aging buckets, collections forecast, disputes, milestone-to-invoice lag, and client/project receivables.
- Store amounts using decimal-safe representation and explicit currency. Never use binary floating-point for money calculations.
- Full statutory tax calculation and ledger posting are out of scope for the first release unless a reviewed accounting specification is provided.

### Module 13 — Workflow and Approval Engine

Requirements:

- Configurable workflow definitions with trigger, conditions, ordered/parallel approval steps, approver resolution, SLA, reminder/escalation policy, reassign/delegate rules, and cancellation/supersession rules.
- Version workflows; in-flight instances remain attached to the version with which they started unless explicitly migrated.
- Each approval instance references the subject resource by type, ID, tenant, and exact version/revision.
- Support approve, reject, request changes, delegate, withdraw, and escalate, all with reason/comment and timestamp.
- Prevent self-approval based on policy; prevent duplicate concurrent decisions through optimistic concurrency/version checks.
- Publish events when approval states change. Consumers must be idempotent.
- Keep workflow configuration as validated data, not arbitrary executable JavaScript supplied by tenant users.

### Module 14 — Documents and File Management

Requirements:

- Centralized document metadata service with binary storage in S3-compatible object storage; local development uses MinIO or another local S3-compatible service.
- Metadata: tenant, owner service/reference, category, file name, MIME type, size, checksum, uploader, created time, visibility, verification state, retention class, and version.
- Use short-lived signed links after access validation. Never make candidate or employee documents public.
- Validate file type, size, magic bytes, and malware-scan status where scanner is available; use quarantine for untrusted files.
- Generate expiring download URLs only after checking tenant, object scope, and document permission.
- Support versioning, verification status, retention/deletion policy, legal hold where required, and access audit.
- Do not log signed URLs or document contents.

### Module 15 — Notifications, Calendar, Meetings, and Internal Engagement

Requirements:

- In-app notification inbox and optional email delivery for approvals, interviews, reminders, ticket assignments, SLA breaches, leave changes, onboarding tasks, probation reviews, payment follow-ups, and incidents.
- Template management with localization/time-zone-aware timestamps, notification preferences, deduplication, retry, dead-letter handling, and delivery status.
- Calendar events for interviews, client meetings, internal reviews, induction, training, holidays, and employee engagement/fun activities.
- Meeting agenda, notes, decisions, action items, owners, due dates, and related client/project/opportunity links.
- Fun activities: create event, eligibility, sign-up/attendance, organizer, capacity, reminder, and optional feedback. Do not expose sensitive attendance/HR data in event participation lists.
- Support external calendar integrations as optional adapters; local functionality must still work without a paid integration.

### Module 16 — Reporting, Executive Dashboards, and Audit

Requirements:

- Role-aware dashboards with filters by date, SBU, team, project, client, status, and owner, filtered on the server.
- Leadership overview: opportunities and weighted pipeline, active/at-risk projects, upcoming milestones, resource demand/capacity, attendance summary, overdue DARs, ticket/SLA metrics, hiring funnel, onboarding/probation tasks, pending approvals, and receivables status.
- Lead dashboard: team work plan, blockers, tickets by age/severity, project delivery, leave coverage, allocation, and review queue.
- HR dashboard: requisitions, stage aging, interview feedback gaps, verification blockers, upcoming joiners, induction tasks, probation due dates, leave summary, and employee lifecycle events.
- Finance dashboard: invoicing pipeline, due/overdue receivables, partial/unallocated payments, disputes, and pending commercial approvals.
- Every metric must have a documented definition and source event/data owner. Do not calculate the same metric differently in multiple screens.
- Exports (CSV/XLSX/PDF as enabled) must enforce the same permissions as on-screen views, record export audit events, and avoid exposing restricted fields.
- Audit viewer filters by actor, action, object, SBU, date, and outcome, scoped to permission. Audit records should be append-only from application code.
- Avoid building executive dashboards through direct live joins across every service database. Use event-fed read models/materialized projections for cross-domain views.

### Module 17 — Agentic AI Assistant (Optional product feature, built after core controls)

AI is a controlled interface to existing authorized workflows, not a separate authority system.

Initial use cases:

- Summarize SBU/project status from data the current user is allowed to see.
- Answer questions about ticket/approval/project status with links to source records.
- Draft a daily report from assigned tickets and entered updates, requiring employee review before submission.
- Summarize interview feedback for an authorized hiring panel without deciding candidate outcomes.
- Prepare a client meeting brief from accessible CRM/project records.
- Detect missing fields, overdue actions, aging risks, and resource conflicts; explain evidence and uncertainty.
- Draft a proposal, onboarding plan, or meeting minutes for human review.

Mandatory safety controls:

- Enforce user authorization before retrieval and again before tool execution. An LLM prompt is not an access-control boundary.
- Default to read-only tools. Any tool that changes a record must be allow-listed and use the same application service and authorization policies as the UI.
- Require explicit confirmation for consequential mutations and workflow approvals. Never let AI approve its own proposed actions.
- Do not let AI autonomously decide hiring, firing, promotion, compensation, leave exceptions, invoice write-offs, payment terms, or release safety.
- Treat uploaded documents, ticket comments, resumes, emails, and client text as untrusted input; defend against prompt injection and data exfiltration.
- Minimize retrieved context, redact sensitive fields, log model/provider/version, tool calls, sources, and human confirmations without logging secrets or unnecessary PII.
- Provide citations/links to source records and state uncertainty. Distinguish factual records from generated summaries.
- Use provider adapters so that an open-source/local model or another provider can be configured without rewriting domain services.
- Keep model credentials server-side; support rate limits, usage limits, timeouts, retries, and graceful disablement.

## 6. Cross-Module End-to-End Workflows

### 6.1 Lead-to-project-to-cash

1. Sales creates a lead and records source/next action.
2. Qualified lead converts to an account/contact/opportunity.
3. Senior Lead reviews stage progression and forecast hygiene.
4. Presales records discovery, assumptions, estimate, proposal version, and commercial terms.
5. Workflow engine routes special pricing/payment terms to Finance validation and the configured SBU Head/commercial approver.
6. Won opportunity with approved proposal converts into a project record and delivery handover.
7. Resource planning proposes assignments; Leads review capacity; escalations route to Senior Lead/SBU Head as policy requires.
8. Project tickets, milestones, QA evidence, and release/change records track delivery.
9. Client acceptance evidence unlocks applicable invoice workflow.
10. Finance issues/records invoices, payments, partial payments, and disputes.
11. Receivables and project health projections update executive reports through domain events.

### 6.2 Hire-to-onboard-to-probation

1. Hiring manager creates a requisition with role, location, grade, budget, and justification.
2. Approval engine routes headcount/budget approval.
3. HR opens the recruitment workflow, schedules interviews, sends notifications, and captures human scorecards.
4. HR checks documents and records verification outcome without exposing documents outside the permitted group.
5. Offer is drafted and routed for approval.
6. Accepted offer creates preboarding tasks and a future employee record.
7. Onboarding assigns HR/IT/manager/employee tasks and induction events.
8. On the start date, the employee becomes active and receives permitted roles/access.
9. Probation review reminders are generated based on effective dates; authorized humans record confirmation/extension decisions.

### 6.3 Daily check-in to daily activity report

1. At check-in, server records a timestamp against the effective work schedule and tenant timezone.
2. Employee submits today’s work plan, linking work items wherever possible.
3. During the day, ticket/project changes feed actual status; employee adds blockers or unplanned work.
4. Check-out/end-of-day prompt collects outcome summaries and carry-forward items.
5. DAR aggregates ticket changes and approved time entries; employee reviews and submits it.
6. Lead reviews exceptions and unresolved blockers, not every keystroke.
7. Overdue reports, blockers, or anomalies create reminders/escalations as configured.
8. Corrections retain prior versions and reasons.

### 6.4 Production/live build approval

1. Release owner opens a release record linked to scope and work items.
2. CI evidence, deployment target, rollback plan, QA test results, security status, and smoke-test plan are attached/linked.
3. QA and technical approvers complete mandatory gates.
4. The designated release approver makes the technical release decision.
5. SBU Head provides business sign-off only if required by policy and only after mandatory technical gates pass.
6. Deployment outcome is recorded by integration or authorized release owner.
7. If post-deployment checks fail, incident/rollback workflow is triggered and linked to the release.

## 7. Recommended Technology Stack

Versions below are a **verified implementation baseline as of 18 October 2026** where the upstream project publishes current status. On project kickoff, install the latest patched stable release within the chosen supported major and commit the lockfile; never copy a stale patch number from this document.

### 7.1 Frontend

- **Next.js 16.x App Router** with the latest security-patched stable release in the 16.x line.
- **React 19.3.x** or the latest compatible patch supported by the selected Next.js release.
- **TypeScript** in strict mode.
- **Tailwind CSS** and an accessible component system such as **shadcn/ui**; use reusable design tokens and shared form/table/dialog primitives.
- **TanStack Query** for server state where useful; avoid a second client-side cache for data already owned by React Server Components unless the interaction requires it.
- **React Hook Form + Zod** or an equivalent typed form/validation pairing.
- **Playwright** for end-to-end/browser tests and **Vitest + Testing Library** for component tests.

### 7.2 Backend

- **Node.js 24 Active LTS** as the production runtime baseline. Node.js 26 is the current line around this document date but its LTS transition is scheduled later in October 2026; prefer the active LTS line for a new production system unless infrastructure policy explicitly chooses otherwise.
- **NestJS with TypeScript** for API services and background consumers. Its module structure, dependency injection, guards, interceptors, and transport adapters suit consistent service boundaries.
- **REST APIs** with OpenAPI contracts; use asynchronous domain events for cross-service propagation. Keep internal service contracts versioned.
- **PostgreSQL 18.x**, latest supported minor at installation, for transactional relational data.
- **Prisma ORM** as the default persistence layer, with explicit migrations and repositories wrapping persistence operations. Use reviewed parameterized SQL for cases where advanced SQL is justified.
- **Redis** for caching, rate limiting, short-lived coordination, and job infrastructure where appropriate. Do not use it as the system of record.
- **NATS JetStream** as an optional open-source event bus for durable domain events; use transactional outbox/inbox patterns for reliable delivery. For simpler early deployments, an alternative single broker is acceptable if the same contracts/idempotency rules are preserved.
- **BullMQ** for scheduled/retryable application jobs if Redis is already part of the stack. Do not use two job systems for the same work without a documented reason.
- **Python 3.12+ and FastAPI** for a separately isolated AI orchestration service if product AI is implemented. Keep business rules and authoritative writes in the domain services, not the LLM service.

### 7.3 Platform and DevOps

- **pnpm workspaces + Turborepo** for monorepo package management and task orchestration.
- **Docker + Docker Compose** for local reproducible development and integration testing.
- **GitHub Actions** (or another CI provider) for lint, typecheck, tests, migrations checks, image build, dependency/security scanning, and artifact creation.
- **OpenTelemetry** for distributed traces and service instrumentation; structured JSON logs and metrics exported to an appropriate backend.
- **Prometheus + Grafana** and **Loki** or equivalent open-source tools for metrics/dashboards/logs. An OpenTelemetry Collector should be used when deployment complexity justifies it.
- **S3-compatible object storage** for files; MinIO locally. Keep storage behind a document service so providers can change.
- **Caddy or Traefik** as a local/prod reverse proxy, TLS termination, and routing layer as appropriate.
- **OpenAPI/Swagger** per service and generated client types where useful.

### 7.4 Stack decision rules

- Pin exact dependencies through the lockfile and automate dependency update review.
- Select compatible framework and runtime releases; latest is not permission to use experimental or unpatched software.
- Do not mix ORMs inside the same service without an architecture decision record (ADR).
- Do not allow the frontend to query databases or service-owned storage directly.
- Keep database credentials service-specific. A shared local Postgres container is acceptable, but services must have separate schemas/databases and restricted roles; production can later split them into separately managed databases.
- Use a modular monorepo for source organization, not a shared-database monolith disguised as microservices.

## 8. Target Architecture and Service Boundaries

### 8.1 SaaS tenancy and trust boundaries

Treat the platform as a multi-tenant SaaS application, not a single-company application with a future tenant column. Use a shared application and shared PostgreSQL cluster initially if that is the operationally economical choice, but enforce tenant isolation throughout the application. Keep the data-access design portable so a future enterprise customer can be moved to a dedicated database or deployment if the product later requires that isolation tier.

Required trust boundaries:

1. **Control plane:** tenant lifecycle, plan catalogue, subscription/entitlement state, platform operator access, service health, and audited support access.
2. **Tenant plane:** tenant-owned employees, teams, HR, CRM, projects, work, approvals, documents, finance records, tenant settings, and tenant reports.
3. **Identity boundary:** a global identity may have membership in several tenants. A request operates in exactly one validated tenant context at a time. Active tenant membership is resolved server-side; a user cannot switch tenants by editing a header, URL, body, or JWT claim without a valid membership and authenticated tenant-selection flow.
4. **Data boundary:** every tenant-owned table has a `tenant_id` or an explicitly documented derivation and enforcement method. Use tenant-qualified foreign keys where practical, tenant-scoped unique indexes, mandatory tenant predicates, service-specific DB credentials, and PostgreSQL RLS as defense in depth. Never treat RLS as a substitute for domain authorization tests.
5. **Async boundary:** every event/job includes a verified `tenantId`, event/job producer identity, correlation ID, and idempotency key where needed. Consumers must validate the tenant and resource ownership before acting. A retry or dead-letter replay must preserve the original tenant scope.
6. **File/search/cache boundary:** object paths, signed-download authorization, search documents, cache keys, lock keys, and export jobs must be tenant-qualified. Signed URLs are short-lived and issued only after current permission checks.
7. **Observability boundary:** operational staff may access health and aggregate reliability metrics. Tenant content and PII must not leak into shared logs, traces, error trackers, or dashboards. Any tenant-specific diagnostics need access control and auditability.

**Tenancy deployment strategy:** implement the shared-database/shared-schema or shared-database/separate-schema model only after choosing and documenting the trade-offs; the baseline recommendation is a shared schema with strict `tenant_id` columns, tenant-qualified constraints, repository filters, and optional RLS because it is straightforward to test in one codebase. Do not implement tenant isolation as database-per-tenant until the operational requirements justify migration/backup/connection-pool complexity. Preserve the ability to introduce a dedicated tenant deployment tier later.

### 8.1 High-level topology

```text
Browser / Mobile Web
        |
        v
Next.js Web App (UI, server-rendered views, feature components)
        |
        v
Edge/API Gateway or BFF (TLS, rate limits, request IDs, routing)
        |
        +--> Tenant Control Plane Service (tenants, plans, subscriptions, entitlements, usage)
        +--> Identity & Access Service
        +--> Organization & Core HR Service
        +--> Recruitment / Talent Acquisition Service
        +--> Time, Attendance & Leave Service
        +--> Work Management / Ticketing Service
        +--> Project Portfolio & Release Service
        +--> CRM & Sales Service
        +--> Presales / Proposal Service
        +--> Resource Planning Service
        +--> Finance / Receivables Service
        +--> Workflow & Approval Service
        +--> Document Service --> S3-compatible object store
        +--> Notification & Calendar Service
        +--> Reporting / Read-Model Service
        +--> AI Orchestration Service (optional, isolated)

Domain services --> service-owned PostgreSQL schema/database
Domain services --> transactional outbox --> durable event bus --> consumers/read models
Cross-cutting: identity propagation, authorization, audit, telemetry, secrets, health checks
```

### 8.2 Service ownership matrix

| Service / bounded context | Owns | Must not own |
|---|---|---|
| API Gateway / BFF | Edge routing, request correlation, coarse rate limits, response composition where needed | Business decisions, master domain data, authorization as the only security layer |
| Tenant Control Plane | Tenant lifecycle, plan/plan versions, subscriptions, feature entitlements, usage metering, platform admin actions, audited support access | Tenant HR/CRM/project business data; implicit read access to customer content |
| Identity & Access | Accounts, credentials/identity links, sessions, tenant membership authentication, roles, permissions, scoped grants | Employee lifecycle facts beyond identity attributes; subscription/plan entitlements |
| Organization & Core HR | SBUs, departments, team/manager relationships, employee lifecycle and permitted profile data, probation | Candidate pipeline before hire; attendance event ledger; invoice state |
| Recruitment / ATS | Requisitions, candidates, interviews, scorecards, offer pipeline, verification status | Active employee master record after handover; credential secrets |
| Time, Attendance & Leave | Punch records, schedules, leave balances/requests, attendance corrections, effective policy snapshots | Project ticket status; employee contract text |
| Work Management / Ticketing | Tickets, workflows, comments, assignment, SLA clocks, work-item activity | Client account master, employee payroll, invoice balances |
| Project Portfolio & Release | Projects, milestones, scope/release records, risks, client acceptance references | Ticket canonical state; invoice ledger |
| CRM & Sales | Accounts, contacts, leads, opportunities, activities, forecast input | Resource allocation decisions, authoritative invoice/payment records |
| Presales / Proposal | Discovery artifacts, estimates, rate-card versions, proposal versions, commercial handover | Master opportunity data; final payment reconciliation |
| Resource Planning | Capacity snapshots, allocation requests/assignments, skills/availability projections | Employee master; canonical attendance punches |
| Finance / Receivables | Invoice/receivable records, incoming payment entries, allocation/reconciliation, commercial finance actions | Candidate/private HR documents; technical release gate results |
| Workflow & Approval | Workflow definitions/versions, instances, approval decisions, delegation, SLA routing | Ownership of the underlying business aggregate |
| Document Service | File metadata, document versions, signed-link issuance, scan/verification metadata | Business decisions about candidate/employment/payment |
| Notification & Calendar | Delivery jobs/status, templates, calendar event metadata, RSVP/engagement events | Authoritative source for leave approval or interview outcome |
| Reporting / Read Models | Denormalized read projections, report definitions, metric metadata, export jobs | Authoritative writes to the source domain |
| AI Orchestration | Conversation state, authorized tool invocation logs, model/provider settings, citations | Authoritative business records or policy-bypass privileges |
| Audit subsystem | Append-only audit events or immutable audit storage interface | Editing/deleting business records or acting as a general analytics database |

### 8.3 Database ownership and cross-service calls

- Each service owns its migrations, schema, DB role, and repositories. A local Postgres cluster may host multiple service databases/schemas, but no service may directly query another service’s tables.
- Read another service’s data through a documented API or an event-fed read model. For synchronous calls, define timeouts, circuit-breaking/backoff, and useful degraded behaviour.
- Cross-domain business processes are sagas/workflows, not distributed database transactions. Use compensating actions for failures.
- Use an outbox table committed in the same transaction as a business write. A publisher emits the event and marks the outbox item delivered. Consumers use idempotency keys/inbox records.
- Include `eventId`, `eventType`, `eventVersion`, `occurredAt`, `tenantId`, `aggregateType`, `aggregateId`, `actorId` (where applicable), `correlationId`, and a minimal payload. Do not publish secrets or unnecessary PII.
- For critical writes use optimistic concurrency (`version` field or equivalent). For operations needing client retries, support `Idempotency-Key`.

### 8.4 Service decomposition guardrail

This is a logical target architecture, not an order to create 17 independently operated services on day one. For an initial delivery, start with independently testable service packages and deploy the most coupled bounded contexts together where operations would otherwise be disproportionate. Keep the data/API boundaries stable so they can be split when justified by ownership, scaling, compliance, or deployment cadence. Never split purely to maximize the number of services.

## 9. Required Code Organization and Layering

### 9.1 Monorepo layout

```text
enterprise-ops-platform/
├── apps/
│   ├── web/                         # Next.js application
│   └── api-gateway/                 # Gateway/BFF; no domain-owned tables
├── services/
│   ├── tenant-control-plane-service/
│   ├── identity-service/
│   ├── organization-service/
│   ├── recruitment-service/
│   ├── attendance-service/
│   ├── work-management-service/
│   ├── project-service/
│   ├── crm-service/
│   ├── presales-service/
│   ├── resource-planning-service/
│   ├── finance-service/
│   ├── workflow-service/
│   ├── document-service/
│   ├── notification-service/
│   ├── reporting-service/
│   └── ai-service/                  # Python/FastAPI, optional
├── packages/
│   ├── api-contracts/               # DTO/event schemas or generated contracts only
│   ├── authz-client/                # typed auth context and policy decision client
│   ├── authorization-policy/        # shared policy schemas, action catalogue, test fixtures; no bypass API
│   ├── config/                      # validated configuration helpers
│   ├── logger/                      # structured logging conventions
│   ├── telemetry/                   # OpenTelemetry bootstrap/helpers
│   ├── ui/                          # design system primitives, not business features
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   ├── docker/
│   ├── compose/
│   ├── monitoring/
│   └── scripts/
├── docs/
│   ├── product/requirements.md
│   ├── architecture/architecture.md
│   ├── architecture/service-catalog.md
│   ├── decisions/ADR-0001-*.md
│   ├── api/
│   ├── security/threat-model.md
│   ├── runbooks/
│   └── operations/
├── .github/workflows/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── .nvmrc
├── .env.example
├── package.json
└── README.md
```

### 9.2 Standard NestJS service structure

Every TypeScript service must follow the same architectural pattern. The exact module names vary by service, but the separation remains consistent.

```text
services/crm-service/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── bootstrap/
│   │   ├── config.ts
│   │   ├── telemetry.ts
│   │   └── swagger.ts
│   ├── common/
│   │   ├── errors/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── decorators/
│   │   ├── pagination/
│   │   └── request-context/
│   ├── modules/
│   │   ├── leads/
│   │   │   ├── leads.module.ts
│   │   │   ├── leads.controller.ts        # HTTP/transport translation only
│   │   │   ├── dto/
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── leads.service.ts        # use cases + transaction coordination
│   │   │   ├── domain/
│   │   │   │   ├── lead.entity.ts
│   │   │   │   ├── lead.rules.ts
│   │   │   │   └── lead.events.ts
│   │   │   ├── repositories/
│   │   │   │   ├── lead.repository.ts      # interface/port
│   │   │   │   └── prisma-lead.repository.ts # persistence adapter
│   │   │   ├── mappers/
│   │   │   └── tests/
│   │   └── opportunities/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── messaging/
│   │   ├── cache/
│   │   ├── storage/
│   │   └── clients/
│   └── health/
├── test/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Backend request path:** `Controller → DTO validation → Authentication/Authorization → Application Service (use case) → Domain rules → Repository interface → Repository implementation → Database`. Events are published through the outbox after a successful transaction. Controllers must not contain business logic or direct ORM queries. Repositories must not decide business policy. Services must not import another service’s Prisma model.

### 9.3 Standard frontend feature structure

```text
apps/web/src/
├── app/                              # routes/layouts, thin composition layer
├── components/
│   ├── ui/                           # shared accessible primitives
│   ├── layout/                       # nav, sidebar, header, breadcrumbs
│   └── feedback/                     # loading, empty, error, permission states
├── features/
│   ├── dashboard/
│   ├── attendance/
│   ├── daily-work/
│   ├── tickets/
│   ├── projects/
│   ├── crm/
│   ├── resource-planning/
│   ├── recruitment/
│   ├── onboarding/
│   ├── leave/
│   ├── approvals/
│   ├── finance/
│   └── admin/
├── lib/
│   ├── api-client/
│   ├── auth/
│   ├── permissions/
│   ├── env/
│   └── date-time/
└── tests/
```

Each frontend feature may contain `components/`, `hooks/`, `api/`, `schemas/`, `types/`, `utils/`, and tests. Feature components must call typed API clients; they must not embed access secrets or call databases. Server-side authorization is authoritative; UI permission checks are for navigation and usability, not security.

### 9.4 Shared package rules

- Shared packages may contain contracts, generic utilities, logging, telemetry, and design-system primitives.
- Do not create a giant `shared` package containing domain entities or business rules imported by every service.
- Avoid circular imports. Enforce package dependency boundaries through linting/architecture tests where possible.
- Share API/event schemas, not persistence models.
- Use explicit DTO-to-domain and domain-to-persistence mapping where it improves validation and boundary clarity.

## 10. API Standards

- Prefix external API routes with `/api/v1` and use resource-oriented REST conventions.
- Generate and publish an OpenAPI specification for every service/gateway version.
- Validate all path, query, and body inputs. Reject unknown fields for sensitive commands where practical. Use output DTOs so the API never serializes internal ORM objects blindly.
- Use ISO 8601 timestamps with timezone indicators; store timestamps canonically in UTC.
- Use opaque IDs (UUID/UUIDv7 or another explicitly chosen ID strategy) and never expose sequential sensitive identifiers where enumeration is a concern.
- List endpoints need bounded pagination, deterministic sorting, server-side filters, and documented defaults/maximums.
- Use consistent errors based on Problem Details (RFC 9457 style) with a stable error code, human-readable message, request/correlation ID, and safe field validation information. Do not return stack traces or secrets.
- Map concurrency conflicts to an explicit conflict response; do not silently overwrite another user's update.
- Use `Idempotency-Key` for retried operations such as creating requests/invoices where duplicate side effects would be harmful.
- Version incompatible contracts and domain events deliberately. Add fields compatibly before removing or renaming them.
- Provide `/health/live` and `/health/ready` or equivalent endpoints. Readiness must reflect critical dependency availability without exposing credentials.
- Support request IDs and correlation IDs from browser/gateway through service calls and event processing.

### 10.1 Example API surface (illustrative; finalize per service OpenAPI)

```text
POST   /api/v1/platform/tenants              # platform operator / secure public onboarding workflow
GET    /api/v1/platform/tenants/{tenantId}
POST   /api/v1/platform/tenants/{tenantId}/lifecycle
GET    /api/v1/platform/plans
GET    /api/v1/tenant/subscription
GET    /api/v1/tenant/entitlements
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/me
GET    /api/v1/me/effective-access           # safe summary for UI; not used as the enforcement mechanism
GET    /api/v1/org/structure
GET    /api/v1/org/teams?parentTeamId=&sbuId=
POST   /api/v1/org/teams
POST   /api/v1/org/teams/{teamId}/memberships
POST   /api/v1/org/reporting-relationships
POST   /api/v1/org/access-groups
POST   /api/v1/org/access-groups/{groupId}/memberships
GET    /api/v1/employees/{employeeId}
POST   /api/v1/attendance/check-in
POST   /api/v1/attendance/check-out
GET    /api/v1/attendance/me?from=&to=
POST   /api/v1/daily-work/plans
POST   /api/v1/daily-work/reports/{reportId}/submit
GET    /api/v1/tickets?status=&assigneeId=&projectId=
POST   /api/v1/tickets
POST   /api/v1/tickets/{ticketId}/transitions
POST   /api/v1/leave/requests
POST   /api/v1/approvals/{approvalId}/decisions
GET    /api/v1/crm/opportunities?stage=&ownerId=
POST   /api/v1/crm/leads
POST   /api/v1/presales/proposals
POST   /api/v1/resource-allocations/requests
POST   /api/v1/recruitment/requisitions
POST   /api/v1/recruitment/candidates/{candidateId}/interviews
POST   /api/v1/finance/invoices
POST   /api/v1/finance/receivables/{receivableId}/payments
GET    /api/v1/reports/executive-overview
```

All endpoints are examples, not a commitment to a single gateway owning all domain code. An endpoint must be implemented in the domain service that owns the aggregate and routed through the gateway/BFF.

## 11. Domain Events and Integration Contracts

Define event contracts with schema validation, versions, idempotency, correlation, and tenant scope. Candidate event catalogue:

- `tenant.provisioned.v1`, `tenant.lifecycle.changed.v1`, `tenant.subscription.changed.v1`, `tenant.entitlement.changed.v1`, `tenant.usage.recorded.v1`
- `identity.user.invited.v1`, `identity.user.activated.v1`, `identity.tenant_membership.changed.v1`, `identity.access_grant.changed.v1`
- `organization.employee.created.v1`, `organization.employee.status_changed.v1`, `organization.reporting_line.changed.v1`, `organization.team.membership.changed.v1`, `organization.access_group.membership.changed.v1`
- `recruitment.requisition.approved.v1`, `recruitment.candidate.stage_changed.v1`, `recruitment.offer.accepted.v1`
- `onboarding.task.completed.v1`, `people.probation.review_due.v1`, `people.probation.decision_recorded.v1`
- `attendance.punch.recorded.v1`, `attendance.correction.approved.v1`, `leave.request.submitted.v1`, `leave.request.decided.v1`
- `work.ticket.created.v1`, `work.ticket.assigned.v1`, `work.ticket.status_changed.v1`, `work.ticket.sla_breached.v1`
- `project.approved.v1`, `project.milestone.accepted.v1`, `release.gate_passed.v1`, `release.approved.v1`, `release.deployed.v1`, `release.rollback_triggered.v1`
- `crm.lead.created.v1`, `crm.opportunity.stage_changed.v1`, `presales.proposal.submitted.v1`, `presales.proposal.approved.v1`
- `resource.allocation.requested.v1`, `resource.allocation.approved.v1`, `resource.capacity_conflict.detected.v1`
- `finance.invoice.issued.v1`, `finance.payment.recorded.v1`, `finance.receivable.overdue.v1`, `finance.commercial_exception.approved.v1`
- `workflow.approval.created.v1`, `workflow.approval.decided.v1`, `workflow.approval.escalated.v1`
- `document.uploaded.v1`, `document.verification.updated.v1`, `notification.delivery.failed.v1`

Event consumers must handle duplicate delivery and out-of-order events safely. Define which events are authoritative and which merely invalidate/rebuild a projection. Events should not contain full resumes, HR documents, authentication material, or full financial records; include identifiers and minimal fields needed for the consumer.

## 12. Core Data Model Guidelines

This is an entity checklist, not a demand to create one giant cross-service schema.

### Organization & Identity

`Tenant`, `TenantMembership`, `TenantDomain`, `PlanVersion`, `Subscription`, `FeatureEntitlement`, `UsageRecord`, `Company`, `SBU`, `Department`, `Team`, `EmployeeTeamMembership`, `AccessGroup`, `AccessGroupMembership`, `Location`, `CostCentre`, `Employee`, `EmploymentPeriod`, `ReportingRelationship`, `ReportingClosure` (derived hierarchy index, if implemented), `JobFamily`, `Grade`, `Skill`, `UserAccount`, `Role`, `Permission`, `RoleGrant`, `PermissionGrant`, `ProjectMembership`, `PolicyVersion`, `Session`, `MFAFactor`.

### Recruitment & People lifecycle

`Requisition`, `Candidate`, `CandidateSource`, `CandidateStageHistory`, `Interview`, `InterviewPanelMember`, `InterviewFeedback`, `DocumentVerification`, `Offer`, `OnboardingPlan`, `OnboardingTask`, `InductionEvent`, `ProbationReview`, `EmploymentLifecycleEvent`.

### Work and time

`WorkSchedule`, `HolidayCalendar`, `AttendancePunch`, `AttendanceCorrection`, `DailyWorkPlan`, `DailyWorkPlanItem`, `DailyActivityReport`, `LeavePolicyVersion`, `LeaveType`, `LeaveBalanceLedgerEntry`, `LeaveRequest`, `LeaveDecision`, `Ticket`, `TicketTransition`, `TicketComment`, `TicketAssignmentHistory`, `SlaClock`, `TimeEntry`.

### CRM, delivery, and resources

`Account`, `Contact`, `Lead`, `Opportunity`, `CrmActivity`, `DiscoveryRecord`, `EstimateVersion`, `RateCardVersion`, `ProposalVersion`, `CommercialApproval`, `Project`, `ProjectScopeVersion`, `Milestone`, `Risk`, `ChangeRequest`, `ReleaseRecord`, `ReleaseGate`, `ResourceProfile`, `CapacitySnapshot`, `AllocationRequest`, `Allocation`, `SkillRequirement`.

### Finance, workflow, files, communications

`Invoice`, `InvoiceLine`, `Receivable`, `PaymentReceipt`, `PaymentAllocation`, `FinancialAdjustment`, `Dispute`, `WorkflowDefinition`, `WorkflowVersion`, `ApprovalInstance`, `ApprovalStep`, `ApprovalDecision`, `Delegation`, `DocumentMetadata`, `DocumentVersion`, `Notification`, `NotificationDelivery`, `CalendarEvent`, `MeetingNote`, `AuditEvent`, `OutboxEvent`, `InboxDeduplicationRecord`.

### Data rules

- Every tenant-owned record includes or derives a verified tenant scope. Use constraints/indexes that support tenant filters; use PostgreSQL Row-Level Security only as an additional defense-in-depth control, not as a substitute for authorization logic and tested repository predicates.
- Use foreign keys and constraints within the service-owned database. Cross-service references are external IDs, validated through APIs/events.
- Define uniqueness scopes intentionally, e.g. employee number unique per tenant, not necessarily globally.
- Use effective-dated records for policies/reporting-line changes that affect history.
- Prefer immutable ledger/history records for attendance corrections, leave adjustments, approval decisions, financial receipts, and audit events.
- Define indexes based on actual list/report access patterns. Avoid unbounded JSON blobs as a replacement for relational modelling.
- Use explicit deletion/retention policies for candidate data, exited employees, attachments, logs, and exports; deletion must respect lawful retention and legal hold requirements.

## 13. Reporting Metrics and Definitions

Create a metric catalogue before building dashboards. Every metric needs owner, formula, inclusion/exclusion rules, timezone, refresh delay, permissions, and source.

Suggested initial metrics:

- **Sales:** open pipeline value, weighted pipeline value, conversion by stage, stage aging, forecast by close period, next-action overdue count, win/loss rate.
- **Project delivery:** schedule variance, milestone completion, scope-change count, risk count by severity, planned vs actual effort, project status age, client acceptance delay.
- **Tickets:** open/overdue/blocked count, severity mix, SLA compliance, mean/median time-to-first-response, resolution time, cycle time, reopened percentage, aging by team.
- **Resource:** committed capacity, available capacity, allocation percentage, forecast utilization, unstaffed demand, skill coverage, overload conflicts.
- **Attendance/work:** scheduled vs recorded hours, missing punches, leave summary, DAR submission rate, planned vs completed items, report exceptions. Do not equate presence with productivity.
- **Recruitment:** requisitions by status, candidates by stage, stage aging, interview feedback outstanding, time-to-fill, offer acceptance rate, verification blockers.
- **People:** onboarding checklist completion, upcoming probation reviews, leave balance exceptions, training/induction completion, lifecycle changes.
- **Finance:** invoice issue lag, open receivables, aging buckets, promised payment dates, disputes, payment allocation status, collections forecast, amount by currency.
- **Governance:** pending approvals by age, overdue escalations, rejected/reworked requests, policy exceptions, audit/export volume.

Cross-service dashboards must use reporting projections and show `lastUpdatedAt` or refresh delay where data is not strongly real-time. Do not present stale projections as live balances.

## 14. Non-Functional Requirements

### 14.1 Availability and performance

Provisional starting targets; validate against expected company size and hosting budget:

- Standard list/detail reads: p95 response time ≤ 500 ms under agreed baseline load, excluding large exports and slow external providers.
- Typical command/write requests: p95 ≤ 800 ms when no external synchronous dependency is required.
- Long-running exports, bulk imports, report generation, email, and AI tasks must run asynchronously with visible job status.
- Initial capacity test: 5,000 employee records and 500 concurrent authenticated sessions as a planning scenario, not a guaranteed result without load testing/infrastructure sizing.
- Initial service availability target: 99.5% monthly for a production deployment, with a documented maintenance and degraded-mode strategy.
- Do not use these targets to justify skipping security or correctness checks.

### 14.2 Reliability and data integrity

- All DB schema changes are migrations reviewed in version control.
- Use database transactions for updates that belong to a single bounded context.
- Use outbox/inbox, idempotency keys, retry policies, dead-letter visibility, and reconciliation jobs for asynchronous workflows.
- Retry only transient failures; do not endlessly retry validation/auth failures.
- Use timeouts and bounded retries on downstream calls; avoid retry storms.
- Backups must be encrypted and restoration tested. A production plan should define target RPO/RTO; a practical target to assess is RPO ≤ 15 minutes and RTO ≤ 4 hours, requiring suitable database backup/WAL and infrastructure support.
- All scheduled jobs need idempotent execution and observable outcomes.

### 14.3 Security and privacy

- Use OWASP ASVS 5.0.0 as a verification baseline and the OWASP API Security Top 10 as an API threat checklist.
- Enforce authentication, authorization, tenant isolation, object-level checks, property-level checks, input validation, output encoding, rate limiting, SSRF controls, CORS policy, secure headers, CSRF protections where applicable, and secure error responses.
- Threat-model privileged workflows, file uploads, document previews, webhooks, exports, password reset, invitation, impersonation/support access, and AI tool invocation.
- Encrypt transport and backups. Use a managed or protected secret store in production; `.env` files are local-only and must not be committed.
- Keep production, staging, and local data separate. Do not populate development fixtures with real personal data.
- Provide an access/revocation process for staff exits and compromised accounts.
- Capture privacy/consent/retention requirements with legal review before production deployment, particularly for employee/candidate personal data and any location/device metadata.

### 14.4 Observability

- Structured logs must contain timestamp, severity, service, environment, request ID, correlation ID, tenant ID where safe, actor ID where safe, and error code—not passwords, bearer tokens, document contents, or unrestricted PII.
- Distributed traces must cross HTTP and event boundaries using trace context propagation.
- Track HTTP latency/error rates, database pool pressure, event publish/consume lag, job retries/dead letters, approval aging, notification delivery, and failed authorization attempts.
- Set actionable alerts for service unavailability, elevated 5xx/error rates, queue lag, repeated job failures, backup failures, and critical SLA/release failures.
- Implement health/readiness endpoints, graceful shutdown, and clear runbooks.

### 14.5 Accessibility and usability

- Follow WCAG 2.2 AA as the target: keyboard navigation, visible focus, semantic labels, contrast, accessible dialogs, errors, table interactions, and screen-reader feedback.
- Provide responsive layouts for desktop and mobile web.
- Include loading, empty, failure, permission-denied, stale-data, and retry states on every data-dependent screen.
- Make destructive/irreversible actions explicit and require confirmation plus a reason where appropriate.
- Use localization-ready date/time/currency formatting. Default timezone and currency are tenant-configured, not hard-coded.

## 15. Testing and Quality Gates

### 15.1 Required test layers

- **Unit tests:** domain rules, permission policy, workday/leave calculations, state transitions, threshold decisions, metric formulas, and mappers.
- **Repository/integration tests:** actual PostgreSQL constraints/migrations, transaction boundaries, tenant filters, outbox/inbox behaviour, idempotency, and persistence mapping.
- **Service integration tests:** API DTO validation, auth guards, authorization, event publishing, downstream failure handling, and response contracts.
- **Contract tests:** OpenAPI and event-schema compatibility between producers/consumers.
- **End-to-end tests:** high-value user workflows from browser through gateway/service/database.
- **Security tests:** cross-tenant IDOR/object-level authorization, privilege escalation, sensitive field leakage, session and token lifecycle, malicious uploads, XSS/CSRF/SSRF cases as relevant, rate limits, and AI prompt-injection/tool-abuse scenarios.
- **Accessibility tests:** automated checks plus manual keyboard/screen-reader review for critical flows.
- **Load tests:** attendance start/end bursts, ticket filtering, approvals dashboards, report exports, event projections, and hiring-period load.

### 15.2 Minimum quality gates per pull request

1. Format and lint pass.
2. Typecheck pass in strict mode.
3. Unit tests pass.
4. Relevant integration and contract tests pass.
5. Migration validation succeeds against a clean database and an upgrade path.
6. Dependency/security scanning runs and material issues are triaged.
7. Build succeeds for changed apps/services.
8. No secret, token, or sensitive sample data is committed.
9. Architecture boundaries are preserved; no direct cross-service DB import/query.
10. README, OpenAPI, or operational docs are updated when behaviour/contracts/configuration change.

Coverage is a diagnostic rather than a substitute for useful tests. Critical calculations and approval/authorization paths should have strong branch coverage and explicit negative tests.

## 16. CI/CD and Runtime Environments

### Environments

- **Local:** Docker Compose with Postgres, Redis, event broker if selected, MinIO, Mailpit or equivalent email catcher, and service containers as needed.
- **CI:** ephemeral databases/brokers and repeatable migrations/integration tests.
- **Staging:** production-like environment with synthetic or properly anonymized data.
- **Production:** locked-down secrets, monitored deployments, backups, controlled migrations, and least-privilege service identities.

### Pipeline stages

1. Install from frozen lockfile.
2. Validate environment/config schemas without leaking secrets.
3. Format/lint/typecheck.
4. Unit/integration/contract tests.
5. Dependency and container image scanning.
6. Build immutable artifacts/images.
7. Run migration compatibility checks.
8. Deploy to staging and run smoke/E2E tests.
9. Manual approval and health checks for production release where policy requires.
10. Track deployment version, commit, migration version, and rollback instructions.

Use backward-compatible expand/migrate/contract database changes when rolling deployments are possible. Do not execute destructive schema changes and application deploys as an unreviewed single step.

## 17. AI Coding Agent Execution Protocol

The coding agent must obey this implementation protocol.

### 17.1 Before editing

- Read this specification, repository README, existing architecture diagrams, and all relevant ADRs.
- Inspect the actual repository state and existing code before proposing new files. Do not assume paths or package managers without checking.
- Produce a concise phase plan, dependency map, affected-file list, data model/API changes, and test plan for the task at hand.
- Identify ambiguous business rules. If the uncertainty is low-risk, document an assumption in an ADR and proceed; if it changes money, access, employment outcomes, retention, or production-release safety, preserve a human approval requirement and mark the policy configurable.

### 17.2 While implementing

- Work one bounded context and one vertical slice at a time. A vertical slice includes migration, DTO/API, use case/service, repository, authorization, tests, and UI where relevant.
- Follow `Controller → DTO validation → AuthZ → Service/use case → Domain rules → Repository → Database`.
- Keep controllers thin; do not put SQL/ORM calls, complex branching, or business rules in controllers/components.
- Add validation and authorization before adding UI polish.
- Build real persistence and useful error handling; do not leave fake in-memory repositories, placeholder APIs, or demo-only security as if production-ready.
- Use migrations for schema changes and explicit seed scripts for demo data. Never seed a default production admin password.
- Keep service-owned data separate. Cross-service interaction must use API contracts or domain events.
- Use environment variables with schema validation; update `.env.example` with names and safe dummy values, never real credentials.
- If an external API is unavailable or paid, isolate it behind an adapter and provide a local/mock integration for tests without misrepresenting it as a live integration.
- Include loading/empty/error/permission-denied states in UI features.
- Write tests alongside each behaviour, especially negative authorization and tenant-isolation cases.
- Update API docs, event contracts, diagrams, runbooks, and the changelog when relevant.

### 17.3 After implementing

- Run the exact affected tests, then the broader quality gates that the environment supports.
- Inspect the final diff for secrets, accidental cross-service imports, weak access checks, hard-coded tenant identifiers, unbounded queries, unhandled async operations, and placeholder TODOs.
- Report what changed, the commands executed, actual pass/fail results, known limitations, migration/deployment notes, and any remaining TODOs.
- Never state “tests pass” unless the tests were actually run and succeeded.
- Never silently disable, skip, or weaken an existing test to make a build green. If a test is invalid, explain and replace it with an equivalent test.
- Do not refactor unrelated modules in the same change unless required and documented.

### 17.4 Implementation definition of done

A feature is complete only when:

- Requirements and acceptance criteria are satisfied.
- Data schema and migrations are committed where needed.
- Input validation, server-side authorization, tenant/object scoping, employee/team/reporting-tree policy evaluation, and field visibility are tested.
- SaaS tenant lifecycle, server-side entitlements, tenant-qualified asynchronous processing, file/export isolation, and cross-tenant denial tests are complete.
- Business logic resides in the appropriate service/domain layer.
- All errors and concurrency cases have deliberate behaviour.
- Relevant domain events/outbox handling are implemented where needed.
- API/UI is connected to real persistence (or the item is explicitly labelled as a design-only spike).
- Logging, metrics/trace context, and audit history are added at the required level.
- Automated tests pass and a human-readable test report is provided.
- Documentation and environment examples are updated.
- No unresolved security-critical TODO remains.

## 18. Delivery Roadmap and Vertical Slices

Do not implement every service before delivering a working user journey. The order below establishes platform controls first, then a coherent operational workflow, then HR/CRM depth.

### Phase 0 — Engineering foundation

Deliver:

- Monorepo, package manager/runtime pins, lint/format/typecheck/test commands, environment validation, Docker Compose, configuration conventions, structured logs, request/correlation IDs, health checks, and CI.
- Architecture docs, ADR template, threat-model outline, service ownership map, OpenAPI/event conventions, migration conventions, and `.env.example`.
- One reference NestJS service and one Next.js feature proving the required layering.

Exit criteria: a clean clone can install, start dependencies, run tests, and start the reference service using documented commands.

### Phase 1 — Identity, tenant scope, organization directory, audit, and approvals

Deliver:

- SaaS tenant provisioning/lifecycle baseline, tenant-bound identity memberships, login/session lifecycle, user invitations, role/permission scopes, plan entitlements, tenant/SBU/team hierarchy, employee directory basics, effective-dated team membership and manager relationships, audit events, and generic approval lifecycle.
- Seeded demo hierarchy for SBU Head → Senior Lead → Lead → functional resources/interns, plus at least two independent demo tenants.
- Implement the `authorize(subject, action, resource, context)` policy contract with RBAC + ABAC + relationship checks and field-level filtering.
- Negative tests for cross-tenant access, unscoped IDs, tenant switching, old-team access after transfer, reporting-line changes, expired delegation, role escalation, self-approval, entitlement bypass, and sensitive field leakage.

Exit criteria: the system can prove who may see and approve one sample request at every hierarchy level.

### Phase 2 — Attendance, leave, daily plan, and DAR

Deliver:

- Check-in/out, schedules/holiday rules, leave request/approval, attendance corrections, daily work plans, DAR, reminders, leader views, and versioned workday rules.

Exit criteria: full employee-to-manager flow passes E2E tests; corrections preserve historical records and are auditable.

### Phase 3 — Tickets, project portfolio, resource planning, and release controls

Deliver:

- Ticket lifecycle, SLA, project pipeline, milestones, capacity/allocations, QA/release gates, deployment evidence, and team reporting.

Exit criteria: create a project, allocate resources, track work to release, and block release if a mandatory gate fails.

### Phase 4 — CRM, presales, proposal approvals, finance/receivables

Deliver:

- Accounts/leads/opportunities, sales activities, estimation/proposal versions, commercial approval policy, project handover, invoices, receipt recording, aging, and reconciliation reporting.

Exit criteria: the lead-to-project-to-cash flow is traceable without duplicate master records or bypassing commercial approvals.

### Phase 5 — Recruitment, onboarding, induction, probation, documents, calendar

Deliver:

- Requisition approvals, candidates, interview scheduling/scorecards, verification, offers, onboarding tasks, induction, probation reviews, document protection, and internal events.

Exit criteria: hire-to-probation E2E flow succeeds with role-protected candidate/employee documents and human decision points.

### Phase 6 — Executive reporting, operational hardening, and optional AI copilot

Deliver:

- Defined metric catalogue, report projections, exports/audits, dashboards, load/security/accessibility testing, backup restore drill, runbooks, and an AI assistant limited to safe authorized use cases.

Exit criteria: dashboards disclose freshness, cross-domain metrics reconcile to source records, AI cannot bypass user permissions or approve consequential actions, and production release procedures are documented.

### Later modules requiring separate specifications

- Statutory payroll and payslips, taxes/contributions, bank disbursement, expenses/reimbursements, travel management, performance/OKRs/360 feedback, learning management, formal surveys/rewards, customer portal, mobile app, advanced data warehouse, and external accounting/payroll integrations.

## 19. Required Screens and Navigation

Build navigation from permissions and job responsibilities. Proposed top-level areas:

1. **Home / My Day:** check-in/out, today’s work plan, assigned tickets, blockers, pending approvals, reminders, and daily report.
2. **My Team:** team status, attendance exceptions, DAR review, leave/coverage, tickets/workload, and capacity.
3. **Work:** tickets, boards, sprints/iterations if enabled, projects, releases, and incident/escalation views.
4. **CRM & Sales:** accounts, contacts, leads, opportunities, activities, pipeline/forecast.
5. **Presales:** discovery, estimates, proposals, commercial approvals, handover.
6. **Resource Planning:** demand, skills, capacity, assignments, allocation approval.
7. **People / HR:** employee directory, recruitment, interview calendar, verification, onboarding, induction, probation, leave, policies, and events.
8. **Finance:** commercial terms, invoices, receivables, payments, disputes, and collections dashboard.
9. **Approvals:** assigned to me, submitted by me, delegated, overdue, history, and escalation.
10. **Reports:** SBU/functional dashboards, export jobs, metric definitions, audit views where authorized.
11. **Administration:** organization/configuration, role management, policies, workflow definitions, notification templates, integration status, and system health.
12. **AI Assistant:** only available to users with permitted access; sources and proposed actions are visible.

Every screen with restricted data must support a permission-denied state. Navigation filtering must not substitute for API enforcement.

## 20. Open Policy Decisions (Keep Configurable Until Approved)

The coding agent must not invent permanent company policy for these items. Implement settings and document safe defaults:

- How many SBUs/departments/locations exist and who owns each.
- Workweek, shift patterns, grace periods, breaks, late marks, overtime, remote/hybrid rules, and working-hour calculations.
- Leave types, entitlement/accrual, carry-forward, encashment, holidays, blackout periods, and approval chain.
- What constitutes a missed or late daily report and whether any reminder/escalation applies.
- Ticket priority/severity definitions, support hours, pause rules, SLA targets, and customer visibility.
- Project stage and health definitions, milestone acceptance rules, and required release gates.
- Opportunity stages, probability values, forecasting formulas, discount/margin limits, and delegated financial authority.
- Allocation limits, utilization targets, junior/intern mentoring requirements, and skill levels.
- Candidate retention, consent notices, verification requirements, interview scorecard schema, and offer approval limits.
- Document retention and legal hold policies; sensitive field access; audit retention period.
- Supported currencies, time zones, taxes/accounting integrations, and payment reconciliation workflow.
- AI providers/models, allowed tools, context retention, model data processing terms, and usage limits.

## 21. Reference Links and Standards

The following sources informed the stack/security baseline. Re-check release pages and security advisories at implementation time.

- [Node.js release schedule](https://github.com/nodejs/Release): runtime lifecycle and LTS status.
- [Next.js release/news](https://nextjs.org/blog): current stable release and security updates; 16.4 was announced in October 2026.
- [React version status](https://react.dev/versions): React 19.3 is listed as the current version in October 2026.
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/): supported major/minor versions; use the current minor for a supported major.
- [NestJS microservices documentation](https://docs.nestjs.com/microservices/basics): transport-based microservice patterns and event/request-response messaging.
- [OpenTelemetry JavaScript documentation](https://opentelemetry.io/docs/languages/js/): instrumentation and traces/metrics/logging support.
- [OWASP ASVS releases](https://github.com/OWASP/ASVS/releases): stable release information; v5.0.0 is identified as the current stable release in the September 2026 release notes.
- [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/): API risks including object-level and function-level authorization.
- [Darwinbox HRMS Suite](https://darwinbox.com/en-us/solutions/use-cases/hrms-suite): market reference for core HR, time/attendance, payroll/expenses, recruitment/onboarding, engagement, talent management, and people analytics.

---

## Final Instruction to the Agent

Implement the platform as a coherent, secure, auditable business system—not as a collection of disconnected dashboards. Begin with Phase 0, prove the architecture with one vertical slice, and proceed phase by phase. Preserve the separation between job seniority and permissions, between operational visibility and confidential record access, between business sign-off and technical release gates, and between AI recommendations and human decisions. Do not advance to the next phase until the current phase’s exit criteria are demonstrated with tests and documented evidence.
