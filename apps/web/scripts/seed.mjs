import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/crypto/index.ts";

const prisma = new PrismaClient();

const T_A = "00000000-0000-4000-8000-0000000000aa";
const T_B = "00000000-0000-4000-8000-0000000000bb";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

const EMP_A = "00000000-0000-4000-8000-000000000011";
const EMP_B = "00000000-0000-4000-8000-000000000012";

const TEAM_A = "00000000-0000-4000-8000-000000000021";
const REQ_A1 = "00000000-0000-4000-8000-00000000a001";
const CAND_A1 = "00000000-0000-4000-8000-00000000a011";

async function main() {
  console.log("Seeding database...");

  const passwordHashA = await hashPassword("Sup3rSecret!");
  const passwordHashB = await hashPassword("An0therSecret!");

  const tenantA = await prisma.tenantWorkspace.upsert({
    where: { id: T_A },
    update: {},
    create: {
      id: T_A,
      tenantId: T_A,
      name: "Acme Corp",
      slug: "acme.opsengine.enterprise",
    },
  });

  const tenantB = await prisma.tenantWorkspace.upsert({
    where: { id: T_B },
    update: {},
    create: {
      id: T_B,
      tenantId: T_B,
      name: "Globex Inc",
      slug: "globex.opsengine.enterprise",
    },
  });

  const adminA = await prisma.authUser.upsert({
    where: { id: USER_A },
    update: {},
    create: {
      id: USER_A,
      tenantId: T_A,
      email: "admin@acme.opsengine.enterprise",
      passwordHash: passwordHashA,
      isRootAdmin: true,
    },
  });

  const userB = await prisma.authUser.upsert({
    where: { id: USER_B },
    update: {},
    create: {
      id: USER_B,
      tenantId: T_B,
      email: "user@globex.opsengine.enterprise",
      passwordHash: passwordHashB,
    },
  });

  const teamA = await prisma.team.upsert({
    where: { id: TEAM_A },
    update: {},
    create: {
      id: TEAM_A,
      tenantId: T_A,
      name: "Engineering Core",
    },
  });

  const empA = await prisma.employee.upsert({
    where: { id: EMP_A },
    update: {},
    create: {
      id: EMP_A,
      tenantId: T_A,
      userId: USER_A,
      displayName: "Alex Mercer",
      employeeNumber: "EMP-001",
      workEmail: "admin@acme.opsengine.enterprise",
      jobTitle: "VP Engineering",
      department: "Engineering",
      employmentType: "full_time",
      employmentStatus: "active",
    },
  });

  const empB = await prisma.employee.upsert({
    where: { id: EMP_B },
    update: {},
    create: {
      id: EMP_B,
      tenantId: T_B,
      userId: USER_B,
      displayName: "Bob Globex",
      employeeNumber: "EMP-002",
      workEmail: "user@globex.opsengine.enterprise",
      jobTitle: "Software Engineer",
      department: "Engineering",
      employmentType: "full_time",
      employmentStatus: "active",
    },
  });

  await prisma.requisition.upsert({
    where: { id: REQ_A1 },
    update: {},
    create: {
      id: REQ_A1,
      tenantId: T_A,
      jobTitle: "Senior Software Engineer",
      hiringManagerId: EMP_A,
      status: "approved",
      headcount: 1,
    },
  });

  await prisma.candidate.upsert({
    where: { id: CAND_A1 },
    update: {},
    create: {
      id: CAND_A1,
      tenantId: T_A,
      fullName: "Jane Doe",
      email: "jane.doe@example.com",
      status: "offer",
      linkedRequisitionId: REQ_A1,
    },
  });

  // ---- Feature #11 + #12: Grants for Acme admin ----
  const permissionsA = [
    "recruit.offer.read",
    "recruit.offer.create",
    "recruit.offer.send",
    "recruit.offer.decide",
    "recruit.offer.approve",
    "onboarding.plan.read",
    "onboarding.plan.create",
    "onboarding.plan.update",
    "onboarding.task.manage",
    "onboarding.induction.manage",
    "onboarding.probation.read",
    "onboarding.probation.review",
    "onboarding.probation.decide",
    "onboarding.convert_employee",
    "assistant.use",
    "assistant.manage",
    "leave.request.create",
    "leave.request.read_self",
    "leave.request.read_team",
    "leave.request.approve",
    "leave.balance.read_self",
    "leave.balance.read_team",
    "leave.balance.adjust",
    "leave.type.manage",
    "time.attendance.read_team",
    "time.attendance.correct_approve",
    "org.manage_roles",
    "org.manage_employees",
  ];
  for (let i = 0; i < permissionsA.length; i++) {
    const key = permissionsA[i];
    const id = `00000000-0000-4000-8000-00000000fe${String(i).padStart(2, "0")}`;
    await prisma.permissionGrant.upsert({
      where: { id },
      update: {},
      create: {
        id,
        tenantId: T_A,
        principalUserId: USER_A,
        principalEmployeeId: EMP_A,
        permissionKey: key,
        scopeType: "TENANT",
        scopeId: null,
        reason: "seed",
      },
    });
  }

  const OFFTPL_A1 = "00000000-0000-4000-8000-00000000fd10";
  const OFFER_A1 = "00000000-0000-4000-8000-00000000fd11";
  const ONB_A1 = "00000000-0000-4000-8000-00000000fd12";

  await prisma.offerTemplate.upsert({
    where: { id: OFFTPL_A1 },
    update: {},
    create: {
      id: OFFTPL_A1,
      tenantId: T_A,
      name: "Standard Software Engineer Offer",
      jobFamily: "Engineering",
      employmentType: "full_time",
      body: "We are delighted to offer you the position of {{jobTitle}} at OpsEngine.",
      defaultTermsDays: 14,
      active: true,
      version: 1,
      createdBy: USER_A,
    },
  });

  await prisma.offer.upsert({
    where: { id: OFFER_A1 },
    update: {},
    create: {
      id: OFFER_A1,
      tenantId: T_A,
      number: "OFF-2026-0001",
      candidateId: CAND_A1,
      requisitionId: REQ_A1,
      templateId: OFFTPL_A1,
      jobTitle: "Senior Software Engineer",
      employmentType: "full_time",
      location: "San Francisco, CA",
      workMode: "hybrid",
      startDate: new Date("2026-11-01T00:00:00Z"),
      baseCompCents: 18000000n,
      variableCents: 2000000n,
      currency: "USD",
      status: "accepted",
      sentAt: new Date("2026-10-10T00:00:00Z"),
      respondedAt: new Date("2026-10-12T00:00:00Z"),
      createdBy: USER_A,
    },
  });

  await prisma.onboardingPlan.upsert({
    where: { id: ONB_A1 },
    update: {},
    create: {
      id: ONB_A1,
      tenantId: T_A,
      candidateId: CAND_A1,
      offerId: OFFER_A1,
      jobFamily: "Engineering",
      location: "San Francisco, CA",
      employmentType: "full_time",
      status: "in_progress",
      startedOn: new Date("2026-11-01T00:00:00Z"),
      buddyEmployeeId: EMP_A,
      notes: "Welcome aboard!",
      createdBy: USER_A,
    },
  });

  // ---- Leave Management Types and Balances ----
  const standardTypes = [
    { code: "ANNUAL", name: "Annual / Paid Leave", allowance: 18, isPaid: true },
    { code: "SICK", name: "Sick Leave", allowance: 10, isPaid: true },
    { code: "CASUAL", name: "Casual Leave", allowance: 7, isPaid: true },
    { code: "UNPAID", name: "Unpaid Leave (LOP)", allowance: 0, isPaid: false },
  ];

  for (const st of standardTypes) {
    const lt = await prisma.leaveType.upsert({
      where: {
        tenantId_code: { tenantId: T_A, code: st.code },
      },
      update: {},
      create: {
        tenantId: T_A,
        code: st.code,
        name: st.name,
        annualAllowance: st.allowance,
        isPaid: st.isPaid,
        requiresApproval: true,
        allowHalfDay: true,
        active: true,
      },
    });

    // Seed balance for EMP_A for 2026
    await prisma.leaveBalance.upsert({
      where: {
        tenantId_employeeId_leaveTypeId_year: {
          tenantId: T_A,
          employeeId: EMP_A,
          leaveTypeId: lt.id,
          year: 2026,
        },
      },
      update: {},
      create: {
        tenantId: T_A,
        employeeId: EMP_A,
        leaveTypeId: lt.id,
        year: 2026,
        allocatedDays: st.allowance,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  }

  console.log("Seeded successfully with assistant grants, leave types, balances, and demo data!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
