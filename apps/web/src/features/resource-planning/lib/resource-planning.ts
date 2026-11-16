// Feature #11 — Resource Planning & Capacity Management (PRD Module 11).

export interface EmployeeCapacitySummary {
  employeeId: string;
  displayName: string;
  department: string | null;
  totalAllocatedPct: number;
  utilizationStatus: "under_utilized" | "optimal" | "over_utilized";
}

export function computeUtilizationStatus(totalAllocatedPct: number): "under_utilized" | "optimal" | "over_utilized" {
  if (totalAllocatedPct < 70) return "under_utilized";
  if (totalAllocatedPct <= 100) return "optimal";
  return "over_utilized";
}

export function aggregateSbuCapacity(summaries: EmployeeCapacitySummary[]): {
  totalEmployees: number;
  avgAllocationPct: number;
  overUtilizedCount: number;
} {
  if (summaries.length === 0) return { totalEmployees: 0, avgAllocationPct: 0, overUtilizedCount: 0 };
  const totalEmployees = summaries.length;
  const sumPct = summaries.reduce((acc, s) => acc + s.totalAllocatedPct, 0);
  const overUtilizedCount = summaries.filter((s) => s.utilizationStatus === "over_utilized").length;
  return {
    totalEmployees,
    avgAllocationPct: Math.round(sumPct / totalEmployees),
    overUtilizedCount,
  };
}
