import { describe, it, expect } from "vitest";
import {
  canConvertLead,
  canTransitionLead,
  canTransitionOpportunity,
  formatCents,
  isGovernedOpportunityStage,
  isValidCents,
  isValidConvertTarget,
  isValidProbability,
  parseAmountToCents,
  OPPORTUNITY_STAGES,
  LEAD_STATUSES,
} from "../features/crm/lib/crm";

describe("crm lead transitions", () => {
  it("valid and invalid lead transitions", () => {
    expect(canTransitionLead("new", "working")).toBe(true);
    expect(canTransitionLead("new", "qualified")).toBe(true);
    expect(canTransitionLead("working", "qualified")).toBe(true);
    expect(canTransitionLead("qualified", "working")).toBe(true);
    expect(canTransitionLead("unqualified", "working")).toBe(true);
    expect(canTransitionLead("new", "converted")).toBe(false);
    expect(canTransitionLead("qualified", "converted")).toBe(false);
    expect(canTransitionLead("converted", "working")).toBe(false);
    expect(canTransitionLead("unqualified", "qualified")).toBe(false);
  });

  it("converted is terminal and cannot be reached via PATCH matrix", () => {
    for (const from of LEAD_STATUSES) {
      expect(canTransitionLead(from, "converted")).toBe(false);
    }
  });

  it("canConvertLead only for non-converted", () => {
    expect(canConvertLead({ status: "new" } as any)).toBe(true);
    expect(canConvertLead({ status: "converted" } as any)).toBe(false);
  });
});

describe("crm opportunity stage matrix", () => {
  it("valid forward/backward moves", () => {
    expect(canTransitionOpportunity("prospecting", "qualification")).toBe(true);
    expect(canTransitionOpportunity("qualification", "proposal")).toBe(true);
    expect(canTransitionOpportunity("qualification", "negotiation")).toBe(true);
    expect(canTransitionOpportunity("proposal", "negotiation")).toBe(true);
    expect(canTransitionOpportunity("proposal", "qualification")).toBe(true);
    expect(canTransitionOpportunity("negotiation", "proposal")).toBe(true);
  });

  it("won/lost are terminal (no plain transition exits)", () => {
    expect(canTransitionOpportunity("won", "prospecting")).toBe(false);
    expect(canTransitionOpportunity("lost", "proposal")).toBe(false);
    for (const to of OPPORTUNITY_STAGES) {
      expect(canTransitionOpportunity("won", to)).toBe(false);
      expect(canTransitionOpportunity("lost", to)).toBe(false);
    }
  });

  it("won is not reachable via plain transition from any stage", () => {
    for (const from of OPPORTUNITY_STAGES) {
      expect(canTransitionOpportunity(from, "won")).toBe(false);
    }
  });

  it("governed stages flagged", () => {
    expect(isGovernedOpportunityStage("won")).toBe(true);
    expect(isGovernedOpportunityStage("lost")).toBe(true);
    expect(isGovernedOpportunityStage("proposal")).toBe(false);
  });
});

describe("crm money helpers (integer cents; never binary float)", () => {
  it("parses decimal strings to exact cents", () => {
    expect(parseAmountToCents("45000.00")).toBe(4500000);
    expect(parseAmountToCents("0.01")).toBe(1);
    expect(parseAmountToCents("12.5")).toBe(1250);
    expect(parseAmountToCents("12.345")).toBe(null);
    expect(parseAmountToCents("abc")).toBe(null);
    expect(parseAmountToCents(45000)).toBe(45000);
    expect(parseAmountToCents(45.5)).toBe(null);
    expect(parseAmountToCents("-5")).toBe(-500);
  });

  it("rejects non-integer cents", () => {
    expect(isValidCents(100)).toBe(true);
    expect(isValidCents("100")).toBe(true);
    expect(isValidCents("10.5")).toBe(false);
    expect(isValidCents(10.5)).toBe(false);
    expect(isValidCents(null)).toBe(false);
  });

  it("formats cents for display", () => {
    expect(formatCents(4500000, "USD")).toContain("45,000");
    expect(formatCents("12500000", "USD")).toContain("125,000");
  });

  it("probability bounds", () => {
    expect(isValidProbability(0)).toBe(true);
    expect(isValidProbability(100)).toBe(true);
    expect(isValidProbability(101)).toBe(false);
    expect(isValidProbability(-1)).toBe(false);
    expect(isValidProbability(50.5)).toBe(false);
  });

  it("convert target validation", () => {
    expect(isValidConvertTarget("account")).toBe(true);
    expect(isValidConvertTarget("opportunity")).toBe(true);
    expect(isValidConvertTarget("both")).toBe(true);
    expect(isValidConvertTarget("contact")).toBe(false);
    expect(isValidConvertTarget("")).toBe(false);
  });
});
