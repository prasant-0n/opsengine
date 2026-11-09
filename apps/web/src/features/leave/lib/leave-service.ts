import { prisma } from "@/lib/prisma";

export interface ApplyLeaveInput {
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isHalfDay?: boolean;
  reason: string;
}

export interface DecideLeaveInput {
  tenantId: string;
  requestId: string;
  reviewerEmployeeId: string;
  decision: "approve" | "reject";
  reviewNotes?: string;
}

export interface AdjustBalanceInput {
  tenantId: string;
  balanceId: string;
  amountDays: number;
  reason: string;
  adjustedBy: string;
}

function calculateDays(start: Date, end: Date, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diffDays, 1);
}

export async function listLeaveTypes(tenantId: string) {
  return prisma.leaveType.findMany({
    where: { tenantId, active: true },
    orderBy: { name: "asc" },
  });
}

export async function getLeaveBalances(tenantId: string, employeeId: string, year: number) {
  // Ensure default balances exist for all active leave types
  const types = await prisma.leaveType.findMany({
    where: { tenantId, active: true },
  });

  for (const t of types) {
    await prisma.leaveBalance.upsert({
      where: {
        tenantId_employeeId_leaveTypeId_year: {
          tenantId,
          employeeId,
          leaveTypeId: t.id,
          year,
        },
      },
      update: {},
      create: {
        tenantId,
        employeeId,
        leaveTypeId: t.id,
        year,
        allocatedDays: t.annualAllowance,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  }

  const balances = await prisma.leaveBalance.findMany({
    where: { tenantId, employeeId, year },
  });

  return balances.map((b) => {
    const lt = types.find((t) => t.id === b.leaveTypeId);
    return {
      ...b,
      leaveType: lt ?? null,
      availableDays: Math.max(0, b.allocatedDays - b.usedDays - b.pendingDays),
    };
  });
}

export async function applyLeave(input: ApplyLeaveInput) {
  const { tenantId, employeeId, leaveTypeId, startDate, endDate, isHalfDay = false, reason } = input;

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  if (end < start) {
    throw new Error("End date cannot be earlier than start date");
  }

  if (isHalfDay && startDate !== endDate) {
    throw new Error("Half-day leave must start and end on the same date");
  }

  const daysCount = calculateDays(start, end, isHalfDay);
  const year = start.getUTCFullYear();

  // 1. Verify leave type exists and belongs to tenant
  const leaveType = await prisma.leaveType.findFirst({
    where: { id: leaveTypeId, tenantId, active: true },
  });
  if (!leaveType) {
    throw new Error("Invalid or inactive leave type");
  }

  // 2. Overlap check with existing active requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      tenantId,
      employeeId,
      status: { in: ["pending", "approved"] },
      AND: [
        { startDate: { lte: end } },
        { endDate: { gte: start } },
      ],
    },
  });

  if (overlapping) {
    throw new Error("An active or pending leave request already overlaps with these dates");
  }

  // 3. Balance check (for paid leave with positive allowance)
  let balance = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId,
        leaveTypeId,
        year,
      },
    },
  });

  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId,
        year,
        allocatedDays: leaveType.annualAllowance,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  }

  const availableDays = balance.allocatedDays - balance.usedDays - balance.pendingDays;
  if (leaveType.annualAllowance > 0 && availableDays < daysCount) {
    throw new Error(`Insufficient leave balance. Requested ${daysCount} days, but only ${availableDays} available.`);
  }

  // 4. Create request and reserve pending days in balance
  const [created] = await prisma.$transaction([
    prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        daysCount,
        isHalfDay,
        reason,
        status: "pending",
      },
    }),
    prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pendingDays: { increment: daysCount } },
    }),
  ]);

  return created;
}

export async function decideLeave(input: DecideLeaveInput) {
  const { tenantId, requestId, reviewerEmployeeId, decision, reviewNotes } = input;

  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId },
  });

  if (!request) {
    throw new Error("Leave request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Cannot decide request that is already ${request.status}`);
  }

  const year = request.startDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
    },
  });

  if (decision === "approve") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          reviewedBy: reviewerEmployeeId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
        },
      });

      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { decrement: request.daysCount },
            usedDays: { increment: request.daysCount },
          },
        });
      }

      // Mark AttendanceDay records as "leave" for the duration
      const curr = new Date(request.startDate);
      const end = new Date(request.endDate);
      while (curr <= end) {
        const workDate = new Date(curr);
        await tx.attendanceDay.upsert({
          where: {
            tenantId_employeeId_workDate: {
              tenantId,
              employeeId: request.employeeId,
              workDate,
            },
          },
          update: { status: "leave" },
          create: {
            tenantId,
            employeeId: request.employeeId,
            workDate,
            status: "leave",
          },
        });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }

      return updated;
    });
  }

  // Reject
  return prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: "rejected",
        reviewedBy: reviewerEmployeeId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });

    if (balance) {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: request.daysCount },
        },
      });
    }

    return updated;
  });
}

export async function cancelLeave(input: {
  tenantId: string;
  requestId: string;
  employeeId: string;
}) {
  const { tenantId, requestId, employeeId } = input;

  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId, employeeId },
  });

  if (!request) {
    throw new Error("Leave request not found");
  }

  if (request.status === "cancelled" || request.status === "rejected") {
    throw new Error(`Cannot cancel a ${request.status} leave request`);
  }

  const prevStatus = request.status;
  const year = request.startDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
    },
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status: "cancelled" },
    });

    if (balance) {
      if (prevStatus === "pending") {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pendingDays: { decrement: request.daysCount } },
        });
      } else if (prevStatus === "approved") {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: { decrement: request.daysCount } },
        });

        // Reset attendance day status
        const curr = new Date(request.startDate);
        const end = new Date(request.endDate);
        while (curr <= end) {
          const workDate = new Date(curr);
          await tx.attendanceDay.updateMany({
            where: {
              tenantId,
              employeeId: request.employeeId,
              workDate,
              status: "leave",
            },
            data: { status: "not_checked_in" },
          });
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
      }
    }

    return updated;
  });
}

export async function adjustLeaveBalance(input: AdjustBalanceInput) {
  const { tenantId, balanceId, amountDays, reason, adjustedBy } = input;

  const balance = await prisma.leaveBalance.findFirst({
    where: { id: balanceId, tenantId },
  });

  if (!balance) {
    throw new Error("Leave balance record not found");
  }

  return prisma.$transaction([
    prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { allocatedDays: { increment: amountDays } },
    }),
    prisma.leaveAdjustment.create({
      data: {
        tenantId,
        leaveBalanceId: balance.id,
        amountDays,
        reason,
        adjustedBy,
      },
    }),
  ]);
}

export async function getTeamLeaveCalendar(tenantId: string, fromDate: string, toDate: string) {
  const from = new Date(fromDate + "T00:00:00Z");
  const to = new Date(toDate + "T23:59:59Z");

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      status: "approved",
      startDate: { lte: to },
      endDate: { gte: from },
    },
    orderBy: { startDate: "asc" },
  });

  const employeeIds = [...new Set(leaves.map((l) => l.employeeId))];
  const leaveTypeIds = [...new Set(leaves.map((l) => l.leaveTypeId))];

  const [employees, types] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds }, tenantId },
      select: { id: true, displayName: true, department: true, jobTitle: true },
    }),
    prisma.leaveType.findMany({
      where: { id: { in: leaveTypeIds }, tenantId },
      select: { id: true, name: true, code: true, isPaid: true },
    }),
  ]);

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const typeMap = new Map(types.map((t) => [t.id, t]));

  return leaves.map((l) => ({
    ...l,
    employee: empMap.get(l.employeeId) ?? null,
    leaveType: typeMap.get(l.leaveTypeId) ?? null,
  }));
}
