import { describe, it, expect } from "vitest";
import {
  RELEASE_STATUSES,
  RELEASE_GATE_TYPES,
  RELEASE_GATE_STATUSES,
  isKnownReleaseStatus,
  isKnownGateType,
  isKnownGateStatus,
  canApproveRelease,
} from "../features/releases/lib/releases";

describe("Release Management & Deployment Gates domain rules", () => {
  it("validates statuses and gate types", () => {
    expect(RELEASE_STATUSES).toContain("approved");
    expect(RELEASE_GATE_TYPES).toContain("security");
    expect(RELEASE_GATE_STATUSES).toContain("passed");
    expect(isKnownReleaseStatus("deployed")).toBe(true);
    expect(isKnownReleaseStatus("invalid")).toBe(false);
    expect(isKnownGateType("qa")).toBe(true);
    expect(isKnownGateStatus("waived")).toBe(true);
  });

  it("guards release approval based on mandatory gate passage", () => {
    const allPassed = [
      { gateType: "qa", status: "passed" },
      { gateType: "security", status: "passed" },
      { gateType: "change_management", status: "waived" },
      { gateType: "technical", status: "passed" },
    ];
    expect(canApproveRelease(allPassed)).toBe(true);

    const onePending = [
      { gateType: "qa", status: "passed" },
      { gateType: "security", status: "pending" },
    ];
    expect(canApproveRelease(onePending)).toBe(false);

    const oneFailed = [
      { gateType: "qa", status: "passed" },
      { gateType: "security", status: "failed" },
    ];
    expect(canApproveRelease(oneFailed)).toBe(false);
  });
});
