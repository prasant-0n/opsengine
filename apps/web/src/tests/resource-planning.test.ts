import { describe, it, expect } from "vitest";
import {
  computeUtilizationStatus,
  aggregateSbuCapacity,
} from "../features/resource-planning/lib/resource-planning";

describe("Resource Planning & Capacity domain rules", () => {
  it("computes utilization status correctly", () => {
    expect(computeUtilizationStatus(50)).toBe("under_utilized");
    expect(computeUtilizationStatus(100)).toBe("optimal");
    expect(computeUtilizationStatus(120)).toBe("over_utilized");
  });

  it("aggregates SBU capacity metrics correctly", () => {
    const summaries = [
      { employeeId: "1", displayName: "A", department: "Eng", totalAllocatedPct: 80, utilizationStatus: "optimal" as const },
      { employeeId: "2", displayName: "B", department: "Eng", totalAllocatedPct: 120, utilizationStatus: "over_utilized" as const },
    ];
    const metrics = aggregateSbuCapacity(summaries);
    expect(metrics.totalEmployees).toBe(2);
    expect(metrics.avgAllocationPct).toBe(100);
    expect(metrics.overUtilizedCount).toBe(1);
  });
});
