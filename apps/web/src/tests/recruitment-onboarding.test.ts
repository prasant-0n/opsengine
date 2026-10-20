import { describe, it, expect } from "vitest";
import {
  OFFER_STATUSES,
  isKnownOfferStatus,
  isValidAmountCents,
  isOfferEditable,
  canSend,
  isOfferTerminal,
} from "../features/recruitment/lib/offers";
import {
  ONBOARDING_PLAN_STATUSES,
  ONBOARDING_TASK_STATUSES,
  PROBATION_RECOMMENDATIONS,
  isKnownPlanStatus,
  isKnownTaskStatus,
  isKnownProbationRecommendation,
  deriveCompletionPct,
  canConvert,
} from "../features/onboarding/lib/onboarding";

describe("Recruitment Offers domain rules", () => {
  it("validates offer statuses and amounts", () => {
    expect(OFFER_STATUSES).toContain("draft");
    expect(OFFER_STATUSES).toContain("accepted");
    expect(isKnownOfferStatus("approved")).toBe(true);
    expect(isKnownOfferStatus("invalid")).toBe(false);

    expect(isValidAmountCents(1000)).toBe(true);
    expect(isValidAmountCents(0)).toBe(true);
    expect(isValidAmountCents(-5)).toBe(false);
    expect(isValidAmountCents(NaN)).toBe(false);
  });

  it("governs offer editability and transitions", () => {
    expect(isOfferEditable({ status: "draft" })).toBe(true);
    expect(isOfferEditable({ status: "approved" })).toBe(false);

    expect(canSend({ status: "approved" })).toBe(true);
    expect(canSend({ status: "draft" })).toBe(false);

    expect(isOfferTerminal({ status: "accepted" })).toBe(true);
    expect(isOfferTerminal({ status: "draft" })).toBe(false);
  });
});

describe("Onboarding & Probation domain rules", () => {
  it("validates plan/task statuses and probation recommendations", () => {
    expect(ONBOARDING_PLAN_STATUSES).toContain("in_progress");
    expect(ONBOARDING_TASK_STATUSES).toContain("blocked");
    expect(PROBATION_RECOMMENDATIONS).toContain("confirm");
    expect(isKnownPlanStatus("completed")).toBe(true);
    expect(isKnownTaskStatus("waived")).toBe(true);
    expect(isKnownProbationRecommendation("extend")).toBe(true);
    expect(isKnownProbationRecommendation("unknown")).toBe(false);
  });

  it("calculates completion percentage correctly", () => {
    expect(deriveCompletionPct([])).toBe(0);
    expect(deriveCompletionPct([{ status: "completed" }, { status: "pending" }])).toBe(50);
    expect(deriveCompletionPct([{ status: "completed" }, { status: "waived" }, { status: "completed" }])).toBe(100);
  });

  it("guards employee conversion", () => {
    expect(canConvert({ planStatus: "in_progress", hasConfirmation: true })).toBe(true);
    expect(canConvert({ planStatus: "completed", hasConfirmation: false })).toBe(true);
    expect(canConvert({ planStatus: "in_progress", hasConfirmation: false })).toBe(false);
  });
});
