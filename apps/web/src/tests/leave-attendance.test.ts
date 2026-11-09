import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma";
import {
  listLeaveTypes,
  getLeaveBalances,
  applyLeave,
  decideLeave,
  cancelLeave,
} from "../features/leave/lib/leave-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const EMP_A = "00000000-0000-4000-8000-000000000011";
const EMP_B = "00000000-0000-4000-8000-000000000012";

describe("Module 5 — Leave & Attendance Management Engine", () => {
  let annualTypeId: string;
  let sickTypeId: string;

  beforeEach(async () => {
    // Ensure standard leave types exist for Tenant A
    const annual = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: TENANT_A, code: "ANNUAL_TEST" } },
      update: {},
      create: {
        tenantId: TENANT_A,
        code: "ANNUAL_TEST",
        name: "Annual Test Leave",
        annualAllowance: 20,
        isPaid: true,
        requiresApproval: true,
      },
    });
    annualTypeId = annual.id;

    const sick = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: TENANT_A, code: "SICK_TEST" } },
      update: {},
      create: {
        tenantId: TENANT_A,
        code: "SICK_TEST",
        name: "Sick Test Leave",
        annualAllowance: 10,
        isPaid: true,
        requiresApproval: true,
      },
    });
    sickTypeId = sick.id;

    // Clean up test leave requests for EMP_A
    await prisma.leaveRequest.deleteMany({
      where: { tenantId: TENANT_A, employeeId: EMP_A },
    });

    // Reset balances for 2026
    await prisma.leaveBalance.upsert({
      where: {
        tenantId_employeeId_leaveTypeId_year: {
          tenantId: TENANT_A,
          employeeId: EMP_A,
          leaveTypeId: annualTypeId,
          year: 2026,
        },
      },
      update: { allocatedDays: 20, usedDays: 0, pendingDays: 0 },
      create: {
        tenantId: TENANT_A,
        employeeId: EMP_A,
        leaveTypeId: annualTypeId,
        year: 2026,
        allocatedDays: 20,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  });

  it("lists active leave types scoped strictly to tenant", async () => {
    const typesA = await listLeaveTypes(TENANT_A);
    expect(typesA.length).toBeGreaterThanOrEqual(2);
    expect(typesA.every((t) => t.tenantId === TENANT_A)).toBe(true);

    const typesB = await listLeaveTypes(TENANT_B);
    expect(typesB.every((t) => t.tenantId === TENANT_B)).toBe(true);
  });

  it("calculates leave balances with pending and available days", async () => {
    const balances = await getLeaveBalances(TENANT_A, EMP_A, 2026);
    const annual = balances.find((b) => b.leaveTypeId === annualTypeId);
    expect(annual).toBeDefined();
    expect(annual?.allocatedDays).toBe(20);
    expect(annual?.availableDays).toBe(20);
    expect(annual?.pendingDays).toBe(0);
    expect(annual?.usedDays).toBe(0);
  });

  it("submits a leave application, holds pending days, and creates pending request", async () => {
    const req = await applyLeave({
      tenantId: TENANT_A,
      employeeId: EMP_A,
      leaveTypeId: annualTypeId,
      startDate: "2026-11-15",
      endDate: "2026-11-17",
      reason: "Family vacation",
    });

    expect(req.status).toBe("pending");
    expect(req.daysCount).toBe(3);

    const balances = await getLeaveBalances(TENANT_A, EMP_A, 2026);
    const annual = balances.find((b) => b.leaveTypeId === annualTypeId);
    expect(annual?.pendingDays).toBe(3);
    expect(annual?.availableDays).toBe(17);
  });

  it("rejects overlapping leave requests for the same employee", async () => {
    await applyLeave({
      tenantId: TENANT_A,
      employeeId: EMP_A,
      leaveTypeId: annualTypeId,
      startDate: "2026-11-15",
      endDate: "2026-11-17",
      reason: "Trip 1",
    });

    // Overlapping attempt (starts during first leave)
    await expect(
      applyLeave({
        tenantId: TENANT_A,
        employeeId: EMP_A,
        leaveTypeId: sickTypeId,
        startDate: "2026-11-16",
        endDate: "2026-11-19",
        reason: "Trip 2",
      })
    ).rejects.toThrow(/overlap/i);
  });

  it("rejects leave application when available balance is insufficient", async () => {
    await expect(
      applyLeave({
        tenantId: TENANT_A,
        employeeId: EMP_A,
        leaveTypeId: annualTypeId,
        startDate: "2026-11-01",
        endDate: "2026-11-25", // 25 days > 20 allocated
        reason: "Extended holiday",
      })
    ).rejects.toThrow(/insufficient/i);
  });

  it("approves leave: converts pending days to used days and creates attendance records", async () => {
    const req = await applyLeave({
      tenantId: TENANT_A,
      employeeId: EMP_A,
      leaveTypeId: annualTypeId,
      startDate: "2026-12-01",
      endDate: "2026-12-02", // 2 days
      reason: "Personal appointment",
    });

    const approved = await decideLeave({
      tenantId: TENANT_A,
      requestId: req.id,
      reviewerEmployeeId: EMP_A,
      decision: "approve",
      reviewNotes: "Approved by manager",
    });

    expect(approved.status).toBe("approved");

    const balances = await getLeaveBalances(TENANT_A, EMP_A, 2026);
    const annual = balances.find((b) => b.leaveTypeId === annualTypeId);
    expect(annual?.pendingDays).toBe(0);
    expect(annual?.usedDays).toBe(2);
    expect(annual?.availableDays).toBe(18);

    // Verify attendance day record was marked as "leave"
    const attDay = await prisma.attendanceDay.findFirst({
      where: {
        tenantId: TENANT_A,
        employeeId: EMP_A,
        workDate: new Date("2026-12-01T00:00:00Z"),
      },
    });
    expect(attDay?.status).toBe("leave");
  });

  it("cancels an approved leave and restores balance accurately", async () => {
    const req = await applyLeave({
      tenantId: TENANT_A,
      employeeId: EMP_A,
      leaveTypeId: annualTypeId,
      startDate: "2026-12-10",
      endDate: "2026-12-11", // 2 days
      reason: "Conference",
    });

    await decideLeave({
      tenantId: TENANT_A,
      requestId: req.id,
      reviewerEmployeeId: EMP_A,
      decision: "approve",
    });

    // Now cancel
    const cancelled = await cancelLeave({
      tenantId: TENANT_A,
      requestId: req.id,
      employeeId: EMP_A,
    });

    expect(cancelled.status).toBe("cancelled");

    const balances = await getLeaveBalances(TENANT_A, EMP_A, 2026);
    const annual = balances.find((b) => b.leaveTypeId === annualTypeId);
    expect(annual?.usedDays).toBe(0);
    expect(annual?.availableDays).toBe(20);
  });

  it("cross-tenant negative test: Tenant B cannot decide or mutate Tenant A leave request", async () => {
    const reqA = await applyLeave({
      tenantId: TENANT_A,
      employeeId: EMP_A,
      leaveTypeId: annualTypeId,
      startDate: "2026-12-20",
      endDate: "2026-12-21",
      reason: "Winter break",
    });

    // Tenant B attempts to approve Tenant A's request
    await expect(
      decideLeave({
        tenantId: TENANT_B,
        requestId: reqA.id,
        reviewerEmployeeId: EMP_B,
        decision: "approve",
      })
    ).rejects.toThrow(/not found/i);
  });
});
