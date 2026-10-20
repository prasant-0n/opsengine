import { describe, it, expect } from "vitest";
import {
  PRESALES_STATUSES,
  isKnownPresalesStatus,
  isValidAmountCents,
  deriveProposalTotals,
} from "../features/presales/lib/presales";

describe("Presales & Proposal Estimation domain rules", () => {
  it("validates presales statuses and amounts", () => {
    expect(PRESALES_STATUSES).toContain("approved");
    expect(isKnownPresalesStatus("submitted")).toBe(true);
    expect(isKnownPresalesStatus("invalid")).toBe(false);

    expect(isValidAmountCents(1000)).toBe(true);
    expect(isValidAmountCents(0n)).toBe(true);
    expect(isValidAmountCents(-10)).toBe(false);
  });

  it("calculates proposal totals correctly", () => {
    const lines = [
      { hours: 40, hourlyRateCents: 15000n }, // 600000
      { hours: 20, hourlyRateCents: 20000 },  // 400000
    ];
    const { totalAmountCents } = deriveProposalTotals(lines);
    expect(totalAmountCents).toBe(1000000n);
  });
});
