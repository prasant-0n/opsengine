import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/crypto/index.ts";
import crypto from "crypto";

const prisma = new PrismaClient();

// Tenant Identifiers
const T_A = "00000000-0000-4000-8000-0000000000aa"; // Acme Global Enterprise
const T_B = "00000000-0000-4000-8000-0000000000bb"; // Starlight Global Technologies

// Tenant A Users
const USER_A_ADMIN = "00000000-0000-4000-8000-000000000001";
const USER_A_SBU_HEAD = "00000000-0000-4000-8000-000000000003";
const USER_A_DIR = "00000000-0000-4000-8000-000000000004";
const USER_A_LEAD1 = "00000000-0000-4000-8000-000000000005";
const USER_A_LEAD2 = "00000000-0000-4000-8000-000000000006";
const USER_A_DEV1 = "00000000-0000-4000-8000-000000000007";
const USER_A_DEV2 = "00000000-0000-4000-8000-000000000008";
const USER_A_DEV3 = "00000000-0000-4000-8000-000000000009";
const USER_A_QA = "00000000-0000-4000-8000-000000000010";
const USER_A_INTERN = "00000000-0000-4000-8000-000000000013";

// Tenant B Users
const USER_B_ADMIN = "00000000-0000-4000-8000-000000000002";
const USER_B_LEAD = "00000000-0000-4000-8000-000000000020";

// Tenant A Employees
const EMP_A_ADMIN = "00000000-0000-4000-8000-000000000011";
const EMP_A_SBU_HEAD = "00000000-0000-4000-8000-000000000031";
const EMP_A_DIR = "00000000-0000-4000-8000-000000000032";
const EMP_A_LEAD1 = "00000000-0000-4000-8000-000000000033";
const EMP_A_LEAD2 = "00000000-0000-4000-8000-000000000034";
const EMP_A_DEV1 = "00000000-0000-4000-8000-000000000035";
const EMP_A_DEV2 = "00000000-0000-4000-8000-000000000036";
const EMP_A_DEV3 = "00000000-0000-4000-8000-000000000037";
const EMP_A_QA = "00000000-0000-4000-8000-000000000038";
const EMP_A_INTERN = "00000000-0000-4000-8000-000000000039";

// Tenant B Employees
const EMP_B_ADMIN = "00000000-0000-4000-8000-000000000012";
const EMP_B_LEAD = "00000000-0000-4000-8000-000000000040";

// Teams
const TEAM_A_EXEC = "00000000-0000-4000-8000-000000000021";
const TEAM_A_CLOUD = "00000000-0000-4000-8000-000000000022";
const TEAM_A_FINTECH = "00000000-0000-4000-8000-000000000023";
const TEAM_A_QA = "00000000-0000-4000-8000-000000000024";
const TEAM_B_PRODUCT = "00000000-0000-4000-8000-000000000025";

async function main() {
  console.log("==> Initializing Enterprise Multi-Tenant Demo Showcase Seed...");

  const defaultPasswordHash = await hashPassword("Sup3rSecret!");
  const globexPasswordHash = await hashPassword("An0therSecret!");

  // 1. Tenant Workspaces
  console.log("Seeding Workspaces & Subscriptions...");
  await prisma.tenantWorkspace.upsert({
    where: { id: T_A },
    update: {
      name: "Acme Corp",
      domain: "acme.opsengine.enterprise",
      lifecycleStatus: "active",
      aiEnabled: true,
    },
    create: {
      id: T_A,
      tenantId: T_A,
      name: "Acme Corp",
      slug: "acme.opsengine.enterprise",
      domain: "acme.opsengine.enterprise",
      lifecycleStatus: "active",
      aiEnabled: true,
    },
  });

  await prisma.tenantSubscription.upsert({
    where: { tenantId: T_A },
    update: {
      planTier: "enterprise",
      seatLimit: 500,
      status: "active",
    },
    create: {
      tenantId: T_A,
      planTier: "enterprise",
      seatLimit: 500,
      status: "active",
      storageLimitBytes: 107374182400n, // 100GB
      features: [
        "ai_assistant",
        "custom_workflows",
        "advanced_reporting",
        "audit_export",
        "sso",
        "documents",
        "calendar",
        "resource_planning",
      ],
    },
  });

  await prisma.tenantWorkspace.upsert({
    where: { id: T_B },
    update: {
      name: "Starlight Global Technologies",
      domain: "starlight.opsengine.enterprise",
      lifecycleStatus: "active",
    },
    create: {
      id: T_B,
      tenantId: T_B,
      name: "Starlight Global Technologies",
      slug: "starlight.opsengine.enterprise",
      domain: "starlight.opsengine.enterprise",
      lifecycleStatus: "active",
    },
  });

  await prisma.tenantSubscription.upsert({
    where: { tenantId: T_B },
    update: {
      planTier: "professional",
      seatLimit: 50,
      status: "active",
    },
    create: {
      tenantId: T_B,
      planTier: "professional",
      seatLimit: 50,
      status: "active",
      storageLimitBytes: 10737418240n, // 10GB
      features: ["core_hrms", "crm_core", "documents", "calendar"],
    },
  });

  // 2. Auth Users
  console.log("Seeding Users & Permissions...");
  const users = [
    { id: USER_A_ADMIN, tenantId: T_A, email: "admin@acme.opsengine.enterprise", isRootAdmin: true, isSuperadmin: true, pw: defaultPasswordHash },
    { id: USER_A_SBU_HEAD, tenantId: T_A, email: "sarah.jenkins@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_DIR, tenantId: T_A, email: "marcus.vance@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_LEAD1, tenantId: T_A, email: "elena.rostova@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_LEAD2, tenantId: T_A, email: "jordan.hayes@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_DEV1, tenantId: T_A, email: "david.kim@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_DEV2, tenantId: T_A, email: "maya.lin@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_DEV3, tenantId: T_A, email: "liam.oconnor@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_QA, tenantId: T_A, email: "priya.sharma@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_A_INTERN, tenantId: T_A, email: "chloe.bennett@acme.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: defaultPasswordHash },
    { id: USER_B_ADMIN, tenantId: T_B, email: "user@globex.opsengine.enterprise", isRootAdmin: true, isSuperadmin: false, pw: globexPasswordHash },
    { id: USER_B_LEAD, tenantId: T_B, email: "rachel.zane@starlight.opsengine.enterprise", isRootAdmin: false, isSuperadmin: false, pw: globexPasswordHash },
  ];

  for (const u of users) {
    await prisma.authUser.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        passwordHash: u.pw,
        isRootAdmin: u.isRootAdmin,
        isSuperadmin: u.isSuperadmin,
      },
      create: {
        id: u.id,
        tenantId: u.tenantId,
        email: u.email,
        passwordHash: u.pw,
        isRootAdmin: u.isRootAdmin,
        isSuperadmin: u.isSuperadmin,
      },
    });

    // Create Tenant Membership
    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: { tenantId: u.tenantId, userId: u.id },
      },
      update: { status: "active" },
      create: {
        tenantId: u.tenantId,
        userId: u.id,
        status: "active",
      },
    });
  }

  // 3. Teams
  console.log("Seeding Teams & Organizational Structure...");
  const teams = [
    { id: TEAM_A_EXEC, tenantId: T_A, name: "Executive Committee" },
    { id: TEAM_A_CLOUD, tenantId: T_A, name: "Cloud & Infrastructure" },
    { id: TEAM_A_FINTECH, tenantId: T_A, name: "Fintech & Payments Core" },
    { id: TEAM_A_QA, tenantId: T_A, name: "Quality Assurance & Testing" },
    { id: TEAM_B_PRODUCT, tenantId: T_B, name: "Core Platform Development" },
  ];
  for (const t of teams) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name },
      create: { id: t.id, tenantId: t.tenantId, name: t.name },
    });
  }

  // 4. Employees & Reporting Hierarchy
  console.log("Seeding Employee Directory...");
  const employees = [
    { id: EMP_A_ADMIN, tenantId: T_A, userId: USER_A_ADMIN, name: "Alex Mercer", num: "EMP-ACME-001", email: "admin@acme.opsengine.enterprise", title: "VP Engineering", dept: "Engineering", mgr: null },
    { id: EMP_A_SBU_HEAD, tenantId: T_A, userId: USER_A_SBU_HEAD, name: "Sarah Jenkins", num: "EMP-ACME-002", email: "sarah.jenkins@acme.opsengine.enterprise", title: "SBU Head / EVP", dept: "Executive", mgr: null },
    { id: EMP_A_DIR, tenantId: T_A, userId: USER_A_DIR, name: "Marcus Vance", num: "EMP-ACME-003", email: "marcus.vance@acme.opsengine.enterprise", title: "Director of Engineering", dept: "Engineering", mgr: EMP_A_SBU_HEAD },
    { id: EMP_A_LEAD1, tenantId: T_A, userId: USER_A_LEAD1, name: "Elena Rostova", num: "EMP-ACME-004", email: "elena.rostova@acme.opsengine.enterprise", title: "Staff Cloud Architect", dept: "Engineering", mgr: EMP_A_DIR },
    { id: EMP_A_LEAD2, tenantId: T_A, userId: USER_A_LEAD2, name: "Jordan Hayes", num: "EMP-ACME-005", email: "jordan.hayes@acme.opsengine.enterprise", title: "Principal Fintech Engineer", dept: "Engineering", mgr: EMP_A_DIR },
    { id: EMP_A_DEV1, tenantId: T_A, userId: USER_A_DEV1, name: "David Kim", num: "EMP-ACME-006", email: "david.kim@acme.opsengine.enterprise", title: "Sr. Backend Engineer", dept: "Engineering", mgr: EMP_A_LEAD1 },
    { id: EMP_A_DEV2, tenantId: T_A, userId: USER_A_DEV2, name: "Maya Lin", num: "EMP-ACME-007", email: "maya.lin@acme.opsengine.enterprise", title: "Sr. Frontend Engineer", dept: "Engineering", mgr: EMP_A_LEAD2 },
    { id: EMP_A_DEV3, tenantId: T_A, userId: USER_A_DEV3, name: "Liam O'Connor", num: "EMP-ACME-008", email: "liam.oconnor@acme.opsengine.enterprise", title: "Lead SRE & DevOps", dept: "Operations", mgr: EMP_A_LEAD1 },
    { id: EMP_A_QA, tenantId: T_A, userId: USER_A_QA, name: "Priya Sharma", num: "EMP-ACME-009", email: "priya.sharma@acme.opsengine.enterprise", title: "QA Automation Lead", dept: "Quality", mgr: EMP_A_DIR },
    { id: EMP_A_INTERN, tenantId: T_A, userId: USER_A_INTERN, name: "Chloe Bennett", num: "EMP-ACME-010", email: "chloe.bennett@acme.opsengine.enterprise", title: "Software Intern", dept: "Engineering", mgr: EMP_A_DEV1 },
    { id: EMP_B_ADMIN, tenantId: T_B, userId: USER_B_ADMIN, name: "Bob Globex", num: "EMP-STR-001", email: "user@globex.opsengine.enterprise", title: "Director of Technology", dept: "Engineering", mgr: null },
    { id: EMP_B_LEAD, tenantId: T_B, userId: USER_B_LEAD, name: "Rachel Zane", num: "EMP-STR-002", email: "rachel.zane@starlight.opsengine.enterprise", title: "Engineering Lead", dept: "Engineering", mgr: EMP_B_ADMIN },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: {
        displayName: e.name,
        employeeNumber: e.num,
        workEmail: e.email,
        jobTitle: e.title,
        department: e.dept,
        employmentStatus: "active",
      },
      create: {
        id: e.id,
        tenantId: e.tenantId,
        userId: e.userId,
        displayName: e.name,
        employeeNumber: e.num,
        workEmail: e.email,
        jobTitle: e.title,
        department: e.dept,
        employmentType: e.num === "EMP-ACME-010" ? "intern" : "full_time",
        employmentStatus: "active",
      },
    });

    if (e.mgr) {
      await prisma.reportingRelationship.upsert({
        where: { id: `00000000-0000-4000-8000-0000000088${e.id.slice(-2)}` },
        update: {},
        create: {
          id: `00000000-0000-4000-8000-0000000088${e.id.slice(-2)}`,
          tenantId: e.tenantId,
          managerEmployeeId: e.mgr,
          reportEmployeeId: e.id,
          relationshipType: "direct",
        },
      });
    }
  }

  // 5. Full Permission Grants for Admin A
  const permissionsA = [
    "recruit.offer.read", "recruit.offer.create", "recruit.offer.send", "recruit.offer.decide", "recruit.offer.approve",
    "onboarding.plan.read", "onboarding.plan.create", "onboarding.plan.update", "onboarding.task.manage",
    "onboarding.induction.manage", "onboarding.probation.read", "onboarding.probation.review", "onboarding.probation.decide",
    "onboarding.convert_employee", "assistant.use", "assistant.manage", "leave.request.create", "leave.request.read_self",
    "leave.request.read_team", "leave.request.approve", "leave.balance.read_self", "leave.balance.read_team",
    "leave.balance.adjust", "leave.type.manage", "time.attendance.read_team", "time.attendance.correct_approve",
    "org.read_directory", "org.manage_roles", "org.manage_employees", "document.read", "document.upload", "document.verify",
    "document.delete", "calendar.event.read", "calendar.event.create", "calendar.event.update", "calendar.event.delete",
    "meeting.note.manage", "control_plane.read", "control_plane.manage", "crm.account.read", "crm.account.manage",
    "project.read", "project.manage", "finance.invoice.read", "finance.invoice.manage", "report.read",
    "portal.ticket.read", "portal.ticket.create", "portal.ticket.comment", "portal.deliverable.read", "portal.deliverable.signoff", "portal.invoice.read",
    "expense.report.read_self", "expense.report.create", "expense.report.read_team", "expense.report.approve_manager", "expense.report.approve_finance", "expense.report.payout"
  ];
  for (let i = 0; i < permissionsA.length; i++) {
    const key = permissionsA[i];
    const id = `00000000-0000-4000-8000-00000000ea${String(i).padStart(2, "0")}`;
    await prisma.permissionGrant.upsert({
      where: { id },
      update: { permissionKey: key },
      create: {
        id,
        tenantId: T_A,
        principalUserId: USER_A_ADMIN,
        principalEmployeeId: EMP_A_ADMIN,
        permissionKey: key,
        scopeType: "TENANT",
        scopeId: null,
        reason: "enterprise_seed",
      },
    });
  }

  // 6. CRM Accounts & Opportunities
  console.log("Seeding CRM Accounts & Pipeline Opportunities...");
  const ACC_NEXUS = "00000000-0000-4000-8000-00000000ac01";
  const ACC_APEX = "00000000-0000-4000-8000-00000000ac02";
  const ACC_VANGUARD = "00000000-0000-4000-8000-00000000ac03";

  await prisma.crmAccount.upsert({
    where: { id: ACC_NEXUS },
    update: {},
    create: {
      id: ACC_NEXUS,
      tenantId: T_A,
      name: "Nexus Global Financial",
      industry: "Financial Services",
      website: "https://nexus-global.example.com",
      status: "active",
      clientTier: "strategic",
      ownerId: EMP_A_ADMIN,
      notes: "Tier-1 Investment Banking Client, $500k ARR commitment.",
    },
  });

  await prisma.crmAccount.upsert({
    where: { id: ACC_APEX },
    update: {},
    create: {
      id: ACC_APEX,
      tenantId: T_A,
      name: "Apex Logistics & Supply",
      industry: "Supply Chain & Logistics",
      status: "active",
      clientTier: "standard",
      ownerId: EMP_A_ADMIN,
    },
  });

  await prisma.crmAccount.upsert({
    where: { id: ACC_VANGUARD },
    update: {},
    create: {
      id: ACC_VANGUARD,
      tenantId: T_A,
      name: "Vanguard Health Systems",
      industry: "Healthcare Provider",
      status: "active",
      clientTier: "strategic",
      ownerId: EMP_A_SBU_HEAD,
    },
  });

  const OPP_1 = "00000000-0000-4000-8000-000000000c01";
  const OPP_2 = "00000000-0000-4000-8000-000000000c02";

  await prisma.crmOpportunity.upsert({
    where: { id: OPP_1 },
    update: {},
    create: {
      id: OPP_1,
      tenantId: T_A,
      accountId: ACC_NEXUS,
      name: "Core Banking Cloud Modernization",
      stage: "negotiation",
      amountCents: 45000000n, // $450,000
      currency: "USD",
      probability: 85,
      forecastCategory: "commit",
      ownerId: EMP_A_ADMIN,
      expectedCloseDate: new Date("2026-12-15T00:00:00Z"),
    },
  });

  await prisma.crmOpportunity.upsert({
    where: { id: OPP_2 },
    update: {},
    create: {
      id: OPP_2,
      tenantId: T_A,
      accountId: ACC_APEX,
      name: "Fleet Realtime Telemetry Platform",
      stage: "proposal",
      amountCents: 28000000n, // $280,000
      currency: "USD",
      probability: 60,
      forecastCategory: "pipeline",
      ownerId: EMP_A_DIR,
      expectedCloseDate: new Date("2027-01-30T00:00:00Z"),
    },
  });

  // 7. Projects, Milestones & Tickets
  console.log("Seeding Projects, Milestones & Work Tickets...");
  const PROJ_APOLLO = "00000000-0000-4000-8000-000000000b01";
  const PROJ_TITAN = "00000000-0000-4000-8000-000000000b02";

  await prisma.project.upsert({
    where: { id: PROJ_APOLLO },
    update: {},
    create: {
      id: PROJ_APOLLO,
      tenantId: T_A,
      name: "Project Apollo — NextGen Cloud Native Platform",
      code: "APOLLO",
      accountId: ACC_NEXUS,
      ownerId: EMP_A_DIR,
      deliveryLeadId: EMP_A_LEAD1,
      startDate: new Date("2026-08-01T00:00:00Z"),
      endDate: new Date("2027-04-30T00:00:00Z"),
      budgetCents: 50000000n, // $500,000
      status: "active",
      description: "High-throughput cloud architecture delivering 99.999% uptime with sub-5ms API latency.",
    },
  });

  await prisma.project.upsert({
    where: { id: PROJ_TITAN },
    update: {},
    create: {
      id: PROJ_TITAN,
      tenantId: T_A,
      name: "Project Titan — Core Banking & ISO 20022 Payments",
      code: "TITAN",
      accountId: ACC_APEX,
      ownerId: EMP_A_DIR,
      deliveryLeadId: EMP_A_LEAD2,
      startDate: new Date("2026-09-01T00:00:00Z"),
      endDate: new Date("2027-03-31T00:00:00Z"),
      budgetCents: 35000000n, // $350,000
      status: "active",
    },
  });

  // Milestones
  const MILE_A1 = "00000000-0000-4000-8000-000000000b11";
  const MILE_A2 = "00000000-0000-4000-8000-000000000b12";

  await prisma.projectMilestone.upsert({
    where: { id: MILE_A1 },
    update: {},
    create: {
      id: MILE_A1,
      tenantId: T_A,
      projectId: PROJ_APOLLO,
      name: "Phase 1: Architecture Baseline & Zero-Trust Auth",
      dueDate: new Date("2026-10-31T00:00:00Z"),
      status: "completed",
    },
  });

  await prisma.projectMilestone.upsert({
    where: { id: MILE_A2 },
    update: {},
    create: {
      id: MILE_A2,
      tenantId: T_A,
      projectId: PROJ_APOLLO,
      name: "Phase 2: Multi-Region High Availability & Sharding",
      dueDate: new Date("2026-12-15T00:00:00Z"),
      status: "in_progress",
    },
  });

  // Tickets
  const tickets = [
    { id: "00000000-0000-4000-8000-000000000701", proj: PROJ_APOLLO, title: "Implement distributed tracing with OpenTelemetry", type: "feature", prio: "high", status: "in_progress", assignee: EMP_A_DEV1 },
    { id: "00000000-0000-4000-8000-000000000702", proj: PROJ_APOLLO, title: "Resolve race condition in payment idempotency token validation", type: "bug", prio: "critical", status: "in_review", assignee: EMP_A_LEAD1 },
    { id: "00000000-0000-4000-8000-000000000703", proj: PROJ_APOLLO, title: "Implement accessible high-contrast UI component tokens", type: "task", prio: "medium", status: "resolved", assignee: EMP_A_DEV2 },
    { id: "00000000-0000-4000-8000-000000000704", proj: PROJ_TITAN, title: "Automate zero-downtime Canary deployment pipelines", type: "feature", prio: "high", status: "open", assignee: EMP_A_DEV3 },
    { id: "00000000-0000-4000-8000-000000000705", proj: PROJ_TITAN, title: "End-to-end load testing under 15,000 req/sec peak load", type: "task", prio: "high", status: "in_progress", assignee: EMP_A_QA },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: { title: t.title, status: t.status },
      create: {
        id: t.id,
        tenantId: T_A,
        projectId: t.proj,
        title: t.title,
        type: t.type,
        priority: t.prio,
        status: t.status,
        assigneeId: t.assignee,
        reporterId: EMP_A_DIR,
      },
    });
  }

  // 8. Leave Management
  console.log("Seeding Leave Types & Balances...");
  const leaveTypes = [
    { code: "ANNUAL", name: "Annual Vacation", allowance: 24, paid: true },
    { code: "SICK", name: "Sick & Medical Leave", allowance: 12, paid: true },
    { code: "CASUAL", name: "Casual Personal Leave", allowance: 6, paid: true },
    { code: "PARENTAL", name: "Parental Leave", allowance: 90, paid: true },
  ];

  const leaveTypeMap = {};
  for (const lt of leaveTypes) {
    const record = await prisma.leaveType.upsert({
      where: {
        tenantId_code: { tenantId: T_A, code: lt.code },
      },
      update: { annualAllowance: lt.allowance },
      create: {
        tenantId: T_A,
        code: lt.code,
        name: lt.name,
        annualAllowance: lt.allowance,
        isPaid: lt.paid,
        active: true,
      },
    });
    leaveTypeMap[lt.code] = record.id;
  }

  // Balance for Admin and Leads
  await prisma.leaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId: T_A,
        employeeId: EMP_A_ADMIN,
        leaveTypeId: leaveTypeMap["ANNUAL"],
        year: 2026,
      },
    },
    update: {},
    create: {
      tenantId: T_A,
      employeeId: EMP_A_ADMIN,
      leaveTypeId: leaveTypeMap["ANNUAL"],
      year: 2026,
      allocatedDays: 24,
      usedDays: 4,
      pendingDays: 2,
    },
  });

  await prisma.leaveRequest.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      tenantId: T_A,
      employeeId: EMP_A_DEV1,
      leaveTypeId: leaveTypeMap["ANNUAL"],
      startDate: new Date("2026-11-20T00:00:00Z"),
      endDate: new Date("2026-11-22T00:00:00Z"),
      daysCount: 3,
      reason: "Family wedding and travel",
      status: "pending",
    },
  });

  // 9. Finance Invoices & Receivables
  console.log("Seeding Finance Invoices & Receivables...");
  const INV_1 = "00000000-0000-4000-8000-000000000111";
  const INV_2 = "00000000-0000-4000-8000-000000000112";

  await prisma.invoice.upsert({
    where: { id: INV_1 },
    update: {},
    create: {
      id: INV_1,
      tenantId: T_A,
      number: "INV-2026-001",
      accountId: ACC_NEXUS,
      projectId: PROJ_APOLLO,
      status: "issued",
      currency: "USD",
      subtotalCents: 12500000n, // $125,000
      taxCents: 1000000n, // $10,000
      totalCents: 13500000n, // $135,000
      issuedOn: new Date("2026-10-15T00:00:00Z"),
      dueOn: new Date("2026-11-15T00:00:00Z"),
      paymentTermsDays: 30,
    },
  });

  await prisma.invoiceLine.upsert({
    where: {
      invoiceId_lineNumber: { invoiceId: INV_1, lineNumber: 1 },
    },
    update: {},
    create: {
      tenantId: T_A,
      invoiceId: INV_1,
      lineNumber: 1,
      description: "Project Apollo Phase 1 Engineering Deliverables & Cloud Setup",
      quantity: 1,
      unitPriceCents: 12500000n,
      amountCents: 12500000n,
      projectId: PROJ_APOLLO,
    },
  });

  await prisma.receivable.upsert({
    where: { invoiceId: INV_1 },
    update: {},
    create: {
      tenantId: T_A,
      invoiceId: INV_1,
      originalAmountCents: 13500000n,
      paidAmountCents: 0n,
      outstandingCents: 13500000n,
      currency: "USD",
      status: "open",
      dueOn: new Date("2026-11-15T00:00:00Z"),
    },
  });

  await prisma.invoice.upsert({
    where: { id: INV_2 },
    update: {},
    create: {
      id: INV_2,
      tenantId: T_A,
      number: "INV-2026-002",
      accountId: ACC_APEX,
      projectId: PROJ_TITAN,
      status: "paid",
      currency: "USD",
      subtotalCents: 7500000n,
      taxCents: 600000n,
      totalCents: 8100000n,
      issuedOn: new Date("2026-09-01T00:00:00Z"),
      dueOn: new Date("2026-10-01T00:00:00Z"),
      paymentTermsDays: 30,
    },
  });

  // 10. Documents Repository
  console.log("Seeding Document Management System...");
  const DOC_1 = "00000000-0000-4000-8000-000000000d01";
  const DOC_2 = "00000000-0000-4000-8000-000000000d02";

  await prisma.document.upsert({
    where: { id: DOC_1 },
    update: {},
    create: {
      id: DOC_1,
      tenantId: T_A,
      ownerService: "compliance",
      category: "policy",
      fileName: "Acme_Enterprise_ISO27001_Information_Security_Standard.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 2458392,
      checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      storageKey: "compliance/iso27001-v2026.pdf",
      uploaderUserId: USER_A_ADMIN,
      visibility: "internal",
      verificationStatus: "verified",
      verifiedBy: USER_A_ADMIN,
      verifiedAt: new Date(),
    },
  });

  await prisma.document.upsert({
    where: { id: DOC_2 },
    update: {},
    create: {
      id: DOC_2,
      tenantId: T_A,
      ownerService: "finance",
      category: "contract",
      fileName: "Nexus_Global_Master_Services_Agreement_2026_Executed.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 5821034,
      checksumSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      storageKey: "contracts/nexus-msa-2026.pdf",
      uploaderUserId: USER_A_ADMIN,
      visibility: "confidential",
      verificationStatus: "verified",
      verifiedBy: USER_A_ADMIN,
      verifiedAt: new Date(),
    },
  });

  // 11. Calendar & Meetings
  console.log("Seeding Calendar Events & Structured Meeting Decisions...");
  const EVT_1 = "00000000-0000-4000-8000-000000000e01";
  const EVT_2 = "00000000-0000-4000-8000-000000000e02";

  await prisma.calendarEvent.upsert({
    where: { id: EVT_1 },
    update: {},
    create: {
      id: EVT_1,
      tenantId: T_A,
      title: "Q4 Strategic SBU Executive Review & Financial Projections",
      description: "Quarterly review of revenue forecasts, project health indicators, and workforce capacity.",
      eventType: "review",
      startTime: new Date("2026-11-15T14:00:00Z"),
      endTime: new Date("2026-11-15T16:00:00Z"),
      allDay: false,
      location: "Executive Boardroom A & Google Meet",
      status: "scheduled",
      organizerId: USER_A_ADMIN,
      capacity: 25,
      relatedType: "project",
      relatedId: PROJ_APOLLO,
    },
  });

  await prisma.eventAttendee.upsert({
    where: {
      tenantId_eventId_userId: {
        tenantId: T_A,
        eventId: EVT_1,
        userId: USER_A_ADMIN,
      },
    },
    update: {},
    create: {
      tenantId: T_A,
      eventId: EVT_1,
      userId: USER_A_ADMIN,
      status: "accepted",
    },
  });

  await prisma.eventAttendee.upsert({
    where: {
      tenantId_eventId_userId: {
        tenantId: T_A,
        eventId: EVT_1,
        userId: USER_A_SBU_HEAD,
      },
    },
    update: {},
    create: {
      tenantId: T_A,
      eventId: EVT_1,
      userId: USER_A_SBU_HEAD,
      status: "accepted",
    },
  });

  await prisma.meetingNote.upsert({
    where: { eventId: EVT_1 },
    update: {},
    create: {
      tenantId: T_A,
      eventId: EVT_1,
      agenda: "1. Revenue Pipeline Review\n2. Project Apollo Delivery Timeline\n3. Q1 2027 Headcount Approvals",
      notes: "The leadership team confirmed that Project Apollo is tracking 2 weeks ahead of schedule.",
      decisions: [
        { id: "DEC-01", description: "Approved $150,000 additional budget allocation for multi-cloud infrastructure.", approvedBy: "Sarah Jenkins" },
        { id: "DEC-02", description: "Promote Priya Sharma to Lead QA Architect effective Dec 1.", approvedBy: "Marcus Vance" }
      ],
      actionItems: [
        { id: "ACT-01", task: "Submit ISO 20022 certification readiness audit to Nexus Global", assignee: "Jordan Hayes", dueDate: "2026-11-25" },
        { id: "ACT-02", task: "Finalize load testing benchmark documentation", assignee: "Elena Rostova", dueDate: "2026-11-30" }
      ],
      createdBy: USER_A_ADMIN,
    },
  });

  await prisma.calendarEvent.upsert({
    where: { id: EVT_2 },
    update: {},
    create: {
      id: EVT_2,
      tenantId: T_A,
      title: "Sprint 42 Architecture & Production Readiness Sync",
      description: "Bi-weekly engineering sync to review open high-priority bugs and release gates.",
      eventType: "meeting",
      startTime: new Date("2026-11-18T10:00:00Z"),
      endTime: new Date("2026-11-18T11:00:00Z"),
      status: "scheduled",
      organizerId: USER_A_LEAD1,
      capacity: 15,
    },
  });

  // ---- Feature #38: Customer Self-Service Support Portal Seed ----
  console.log("Seeding Customer Portal Contacts, Deliverables & Tickets...");
  const CONTACT_JANE = "00000000-0000-4000-8000-00000000c001";
  await prisma.crmContact.upsert({
    where: { id: CONTACT_JANE },
    update: {},
    create: {
      id: CONTACT_JANE,
      tenantId: T_A,
      accountId: ACC_NEXUS,
      fullName: "Jane Doe",
      email: "jane.nexus@nexusglobal.com",
      title: "VP of Technology",
      isPrimary: true,
    },
  });

  const DELIV_1 = "00000000-0000-4000-8000-00000000d001";
  await prisma.clientDeliverable.upsert({
    where: { id: DELIV_1 },
    update: {},
    create: {
      id: DELIV_1,
      tenantId: T_A,
      projectId: PROJ_APOLLO,
      accountId: ACC_NEXUS,
      title: "Sprint 42 Architecture Blueprint & Production Readiness Package",
      description: "End-to-end architectural specifications, OpenAPI schemas, and disaster recovery runbook.",
      deliverableUrl: "https://opsengine.cloud/artifacts/sprint-42-spec.pdf",
      status: "pending_review",
    },
  });

  const PORTAL_TICKET_1 = "00000000-0000-4000-8000-00000000fa01";
  await prisma.ticket.upsert({
    where: { id: PORTAL_TICKET_1 },
    update: {},
    create: {
      id: PORTAL_TICKET_1,
      tenantId: T_A,
      accountId: ACC_NEXUS,
      projectId: PROJ_APOLLO,
      title: "Production Webhook Delivery Retries Delayed",
      description: "Webhook retries are experiencing longer backoff intervals than expected during peak batch hours.",
      type: "incident",
      priority: "urgent",
      status: "in_progress",
      reporterId: USER_A_ADMIN,
      slaDueAt: new Date(Date.now() + 4 * 3600 * 1000), // 4 hours remaining
    },
  });

  const COMMENT_PUB = "00000000-0000-4000-8000-00000000ca01";
  await prisma.ticketComment.upsert({
    where: { id: COMMENT_PUB },
    update: {},
    create: {
      id: COMMENT_PUB,
      tenantId: T_A,
      ticketId: PORTAL_TICKET_1,
      authorId: USER_A_ADMIN,
      authorType: "staff",
      authorName: "Alex Mercer",
      body: "We have acknowledged the incident and our core platform team is currently monitoring DLQ throughput.",
      isInternal: false,
    },
  });

  const COMMENT_INT = "00000000-0000-4000-8000-00000000ca02";
  await prisma.ticketComment.upsert({
    where: { id: COMMENT_INT },
    update: {},
    create: {
      id: COMMENT_INT,
      tenantId: T_A,
      ticketId: PORTAL_TICKET_1,
      authorId: USER_A_ADMIN,
      authorType: "staff",
      authorName: "Alex Mercer",
      body: "Internal Note: Rate limit on third-party webhook receiver caused exponential backoff to spike. Do not disclose receiver endpoint.",
      isInternal: true,
    },
  });

  // ---- Feature #39: Expense Management & Reimbursements Seed ----
  console.log("Seeding Employee Expense Reports & Itemized Claims...");
  const EXP_REP_1 = "00000000-0000-4000-8000-00000000e001";
  await prisma.expenseReport.upsert({
    where: { id: EXP_REP_1 },
    update: {},
    create: {
      id: EXP_REP_1,
      tenantId: T_A,
      employeeId: EMP_A_LEAD1,
      title: "Q4 Client Technical Onsite & Infrastructure Workshop",
      description: "Travel, lodging and meals for Apollo architecture review with Nexus Global Financials.",
      currency: "USD",
      totalAmountCents: 34500n, // $345.00
      status: "manager_approved",
      managerApproverId: EMP_A_ADMIN,
      submittedAt: new Date("2026-11-10T10:00:00Z"),
      approvedAt: new Date("2026-11-11T14:30:00Z"),
    },
  });

  const EXP_ITEM_1 = "00000000-0000-4000-8000-00000000e101";
  await prisma.expenseItem.upsert({
    where: { id: EXP_ITEM_1 },
    update: {},
    create: {
      id: EXP_ITEM_1,
      tenantId: T_A,
      reportId: EXP_REP_1,
      category: "lodging",
      description: "Business Hotel - 1 Night Stay (Within Policy)",
      amountCents: 21000n, // $210.00
      currency: "USD",
      spentOn: new Date("2026-11-09T00:00:00Z"),
      policyViolation: false,
    },
  });

  const EXP_ITEM_2 = "00000000-0000-4000-8000-00000000e102";
  await prisma.expenseItem.upsert({
    where: { id: EXP_ITEM_2 },
    update: {},
    create: {
      id: EXP_ITEM_2,
      tenantId: T_A,
      reportId: EXP_REP_1,
      category: "meals",
      description: "Working Dinner with Architecture Lead",
      amountCents: 6500n, // $65.00
      currency: "USD",
      spentOn: new Date("2026-11-09T19:30:00Z"),
      policyViolation: false,
    },
  });

  const EXP_ITEM_3 = "00000000-0000-4000-8000-00000000e103";
  await prisma.expenseItem.upsert({
    where: { id: EXP_ITEM_3 },
    update: {},
    create: {
      id: EXP_ITEM_3,
      tenantId: T_A,
      reportId: EXP_REP_1,
      category: "travel",
      description: "Airport Express Transit & Ground Transportation",
      amountCents: 7000n, // $70.00
      currency: "USD",
      spentOn: new Date("2026-11-10T08:00:00Z"),
      policyViolation: false,
    },
  });

  // 17. Feature #40: Statutory Payroll & Payslips
  console.log("Seeding Statutory Payroll & Employee Compensation Packages...");
  const SALARY_STRUCT_DEV1 = "00000000-0000-4000-8000-00000000fa01";
  await prisma.salaryStructure.upsert({
    where: { id: SALARY_STRUCT_DEV1 },
    update: {},
    create: {
      id: SALARY_STRUCT_DEV1,
      tenantId: T_A,
      employeeId: EMP_A_DEV1,
      effectiveFrom: new Date("2026-01-01"),
      currency: "USD",
      basicCents: 600000n, // $6,000.00
      hraCents: 200000n, // $2,000.00
      allowanceCents: 100000n, // $1,000.00
      pfEmployeeCents: 50000n, // $500.00
      pfEmployerCents: 50000n, // $500.00
      taxTdsCents: 70000n, // $700.00
      paymentMethod: "bank_transfer",
      bankName: "JPMorgan Chase",
      bankAccountNumber: "9876543210",
      bankRoutingCode: "021000021",
      status: "active",
    },
  });

  const SALARY_STRUCT_QA = "00000000-0000-4000-8000-00000000fa02";
  await prisma.salaryStructure.upsert({
    where: { id: SALARY_STRUCT_QA },
    update: {},
    create: {
      id: SALARY_STRUCT_QA,
      tenantId: T_A,
      employeeId: EMP_A_QA,
      effectiveFrom: new Date("2026-01-01"),
      currency: "USD",
      basicCents: 500000n, // $5,000.00
      hraCents: 150000n, // $1,500.00
      allowanceCents: 80000n, // $800.00
      pfEmployeeCents: 45000n, // $450.00
      pfEmployerCents: 45000n, // $450.00
      taxTdsCents: 55000n, // $550.00
      paymentMethod: "bank_transfer",
      bankName: "Bank of America",
      bankAccountNumber: "1234567890",
      bankRoutingCode: "026009593",
      status: "active",
    },
  });

  const PAY_RUN_OCT = "00000000-0000-4000-8000-00000000fb01";
  await prisma.payrollRun.upsert({
    where: { id: PAY_RUN_OCT },
    update: {},
    create: {
      id: PAY_RUN_OCT,
      tenantId: T_A,
      runNumber: "PR-2026-10",
      periodYear: 2026,
      periodMonth: 10,
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-31"),
      status: "disbursed",
      totalGrossCents: 1630000n, // $16,300.00
      totalDeductionsCents: 220000n, // $2,200.00
      totalNetCents: 1410000n, // $14,100.00
      totalEmployees: 2,
      executedBy: EMP_A_DIR,
      approvedBy: EMP_A_ADMIN,
      approvedAt: new Date("2026-10-30T10:00:00Z"),
      disbursedAt: new Date("2026-10-31T09:00:00Z"),
      batchExportRef: "BATCH-PR-2026-10-1730365200000",
    },
  });

  const payslipDevHash = crypto
    .createHash("sha256")
    .update(`${T_A}|${PAY_RUN_OCT}|${EMP_A_DEV1}|PAY-202610-0001|2026|10|900000|120000|780000`, "utf8")
    .digest("hex");

  const PAYSLIP_DEV1 = "00000000-0000-4000-8000-00000000fc01";
  await prisma.payslip.upsert({
    where: { id: PAYSLIP_DEV1 },
    update: {},
    create: {
      id: PAYSLIP_DEV1,
      tenantId: T_A,
      payrollRunId: PAY_RUN_OCT,
      employeeId: EMP_A_DEV1,
      payslipNumber: "PAY-202610-0001",
      periodYear: 2026,
      periodMonth: 10,
      workingDays: 31,
      workedDays: 31,
      unpaidLeaveDays: 0,
      basicCents: 600000n,
      hraCents: 200000n,
      allowancesCents: 100000n,
      grossPayCents: 900000n,
      pfEmployeeCents: 50000n,
      pfEmployerCents: 50000n,
      taxTdsCents: 70000n,
      lopDeductionCents: 0n,
      totalDeductionsCents: 120000n,
      netPayCents: 780000n,
      currency: "USD",
      checksumSha256: payslipDevHash,
      status: "published",
      paymentReference: "ACH-PR-2026-10-0001",
      paidAt: new Date("2026-10-31T09:00:00Z"),
    },
  });

  const payslipQaHash = crypto
    .createHash("sha256")
    .update(`${T_A}|${PAY_RUN_OCT}|${EMP_A_QA}|PAY-202610-0002|2026|10|730000|100000|630000`, "utf8")
    .digest("hex");

  const PAYSLIP_QA = "00000000-0000-4000-8000-00000000fc02";
  await prisma.payslip.upsert({
    where: { id: PAYSLIP_QA },
    update: {},
    create: {
      id: PAYSLIP_QA,
      tenantId: T_A,
      payrollRunId: PAY_RUN_OCT,
      employeeId: EMP_A_QA,
      payslipNumber: "PAY-202610-0002",
      periodYear: 2026,
      periodMonth: 10,
      workingDays: 31,
      workedDays: 31,
      unpaidLeaveDays: 0,
      basicCents: 500000n,
      hraCents: 150000n,
      allowancesCents: 80000n,
      grossPayCents: 730000n,
      pfEmployeeCents: 45000n,
      pfEmployerCents: 45000n,
      taxTdsCents: 55000n,
      lopDeductionCents: 0n,
      totalDeductionsCents: 100000n,
      netPayCents: 630000n,
      currency: "USD",
      checksumSha256: payslipQaHash,
      status: "published",
      paymentReference: "ACH-PR-2026-10-0002",
      paidAt: new Date("2026-10-31T09:00:00Z"),
    },
  });

  // 18. Feature #41: Performance Appraisals, OKRs & 360 Feedback
  console.log("Seeding Performance Appraisals, Corporate OKRs & 360 Feedback...");
  const OKR_OBJ_1 = "00000000-0000-4000-8000-00000000fd01";
  await prisma.okrObjective.upsert({
    where: { id: OKR_OBJ_1 },
    update: {},
    create: {
      id: OKR_OBJ_1,
      tenantId: T_A,
      title: "Scale Core Platform to 99.99% Availability & Sub-100ms Latency",
      description: "Cloud-native infrastructure hardening, distributed caching, and automated failover.",
      level: "company",
      ownerEmployeeId: EMP_A_ADMIN,
      department: "Engineering",
      periodYear: 2026,
      periodQuarter: 4,
      progressPercent: 82.5,
      status: "active",
    },
  });

  const OKR_KR_1 = "00000000-0000-4000-8000-00000000fe01";
  await prisma.okrKeyResult.upsert({
    where: { id: OKR_KR_1 },
    update: {},
    create: {
      id: OKR_KR_1,
      tenantId: T_A,
      objectiveId: OKR_OBJ_1,
      title: "Achieve p95 API Latency below 85ms across all tenant workloads",
      targetValue: 85.0,
      currentValue: 82.0,
      unit: "ms",
      confidenceScore: 0.9,
    },
  });

  const OKR_KR_2 = "00000000-0000-4000-8000-00000000fe02";
  await prisma.okrKeyResult.upsert({
    where: { id: OKR_KR_2 },
    update: {},
    create: {
      id: OKR_KR_2,
      tenantId: T_A,
      objectiveId: OKR_OBJ_1,
      title: "Maintain 100% test pass rate across 40+ automated CI suites",
      targetValue: 100.0,
      currentValue: 100.0,
      unit: "%",
      confidenceScore: 1.0,
    },
  });

  const APPRAISAL_CYCLE_2026 = "00000000-0000-4000-8000-00000000ff01";
  await prisma.appraisalCycle.upsert({
    where: { id: APPRAISAL_CYCLE_2026 },
    update: {},
    create: {
      id: APPRAISAL_CYCLE_2026,
      tenantId: T_A,
      name: "2026 Q4 Annual Performance Review & Calibration",
      periodYear: 2026,
      periodQuarter: 4,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-12-15"),
      selfReviewDeadline: new Date("2026-11-15"),
      managerReviewDeadline: new Date("2026-11-30"),
      status: "active",
    },
  });

  const REVIEW_DEV1_SELF = "00000000-0000-4000-8000-00000000ea01";
  await prisma.appraisalReview.upsert({
    where: { id: REVIEW_DEV1_SELF },
    update: {},
    create: {
      id: REVIEW_DEV1_SELF,
      tenantId: T_A,
      cycleId: APPRAISAL_CYCLE_2026,
      employeeId: EMP_A_DEV1,
      reviewerEmployeeId: EMP_A_DEV1,
      reviewType: "self",
      competencyRatings: { technical: 5, delivery: 4, collaboration: 4, ownership: 5, leadership: 4 },
      overallRating: 4.4,
      strengthsSummary: "Architected Zero-Cost Enterprise Cloud DevOps mesh and delivered high-concurrency payroll engine.",
      growthAreas: "Expand cross-departmental pre-sales customer architecture presentations.",
      okrScore: 88.0,
      recommendation: "promotion",
      status: "submitted",
      submittedAt: new Date("2026-11-10T14:00:00Z"),
    },
  });

  const REVIEW_DEV1_MGR = "00000000-0000-4000-8000-00000000ea02";
  await prisma.appraisalReview.upsert({
    where: { id: REVIEW_DEV1_MGR },
    update: {},
    create: {
      id: REVIEW_DEV1_MGR,
      tenantId: T_A,
      cycleId: APPRAISAL_CYCLE_2026,
      employeeId: EMP_A_DEV1,
      reviewerEmployeeId: EMP_A_LEAD1,
      reviewType: "manager",
      competencyRatings: { technical: 5, delivery: 5, collaboration: 4, ownership: 5, leadership: 4 },
      overallRating: 4.6,
      strengthsSummary: "Outstanding technical depth, flawless code review standards, and autonomous execution.",
      growthAreas: "Continue mentoring junior engineers on distributed systems and cryptographic audit proofs.",
      okrScore: 92.0,
      recommendation: "promotion",
      status: "submitted",
      submittedAt: new Date("2026-11-12T16:00:00Z"),
    },
  });

  // Mobile PWA & Push Notification Subscriptions (#42)
  const SUB_A_ADMIN = "00000000-0000-4000-8000-00000000fe01";
  await prisma.pushSubscription.upsert({
    where: { endpoint: "https://fcm.googleapis.com/fcm/send/demo-admin-token-42" },
    update: {},
    create: {
      id: SUB_A_ADMIN,
      tenantId: T_A,
      userId: USER_A_ADMIN,
      endpoint: "https://fcm.googleapis.com/fcm/send/demo-admin-token-42",
      p256dh: "BMc_8_demo_public_key_mock_for_pwa_testing_only_base64_0123456789abcdef",
      auth: "demo_auth_secret_mock_42",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile",
      isActive: true,
    },
  });

  // Accounting ERP Integrations (QuickBooks & Xero) (#43)
  const ERP_INT_QBO_A = "00000000-0000-4000-8000-00000000ea01";
  const ERP_INT_XERO_A = "00000000-0000-4000-8000-00000000ea02";
  const ERP_SYNC_LOG_1 = "00000000-0000-4000-8000-00000000ea11";

  await prisma.erpIntegration.upsert({
    where: {
      tenantId_provider: {
        tenantId: T_A,
        provider: "quickbooks",
      },
    },
    update: {},
    create: {
      id: ERP_INT_QBO_A,
      tenantId: T_A,
      provider: "quickbooks",
      status: "connected",
      realmId: "934145214589",
      coaMapping: {
        revenueAccountCode: "4000",
        receivablesAccountCode: "1100",
        salesTaxAccountCode: "2200",
        bankDepositAccountCode: "1000",
      },
      lastSyncAt: new Date("2026-11-18T04:00:00Z"),
    },
  });

  await prisma.erpIntegration.upsert({
    where: {
      tenantId_provider: {
        tenantId: T_A,
        provider: "xero",
      },
    },
    update: {},
    create: {
      id: ERP_INT_XERO_A,
      tenantId: T_A,
      provider: "xero",
      status: "connected",
      realmId: "xero-org-acme-corp",
      coaMapping: {
        revenueAccountCode: "200",
        receivablesAccountCode: "120",
        salesTaxAccountCode: "800",
        bankDepositAccountCode: "090",
      },
      lastSyncAt: new Date("2026-11-18T04:05:00Z"),
    },
  });

  await prisma.erpSyncLog.upsert({
    where: {
      tenantId_provider_entityType_entityId_idempotencyKey: {
        tenantId: T_A,
        provider: "quickbooks",
        entityType: "invoice",
        entityId: "00000000-0000-4000-8000-000000000111",
        idempotencyKey: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    },
    update: {},
    create: {
      id: ERP_SYNC_LOG_1,
      tenantId: T_A,
      integrationId: ERP_INT_QBO_A,
      provider: "quickbooks",
      entityType: "invoice",
      entityId: "00000000-0000-4000-8000-000000000111",
      externalId: "QBO-INV-1029",
      direction: "outbound",
      status: "success",
      idempotencyKey: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      syncedAt: new Date("2026-11-18T04:00:00Z"),
    },
  });

  console.log("==> Enterprise Multi-Tenant Demo Showcase Seed Complete!");
  console.log(`
Summary of Seeded Data:
- Tenant A: Acme Global Enterprise (acme.opsengine.enterprise) - Enterprise Tier (500 seats)
  - 10 Employees across 5 Teams with Full Manager Reporting Hierarchy
  - 3 CRM Client Accounts ($1.5M+ total pipeline) & 2 Active Opportunities
  - 2 High-Visibility Projects (Apollo & Titan), 2 Milestones, 5 Sprint Tickets
  - Complete Leave Management System (4 Leave Types, Allocations, Pending Requests)
  - Finance Billing System (Invoices INV-2026-001 & 002, Line Items, Receivables, Payments)
  - Verified Document Repository with SHA-256 Checksums
  - Calendar Events with Attendees, Live Notes, Decisions, and Action Items
  - 45+ Granular Permission Grants for Superadmin (Alex Mercer)
- Tenant B: Starlight Global Technologies (starlight.opsengine.enterprise) - Professional Tier (50 seats)
  - Isolated Teams, Users & Employees with Zero Cross-Tenant Leakage
`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
