import { describe, it, expect } from "vitest";
import {
  canTransitionRequisition,
  canTransitionCandidate,
  hasInterviewOverlap,
  REQUISITION_STATUSES,
  CANDIDATE_STATUSES,
  INTERVIEW_STATUSES,
} from "../features/recruitment/lib/recruitment";

describe("ats recruitment helpers", () => {
  it("requisition transitions valid/invalid", () => {
    expect(canTransitionRequisition("draft", "submitted")).toBe(true);
    expect(canTransitionRequisition("draft", "approved")).toBe(false);
    expect(canTransitionRequisition("submitted", "approved")).toBe(true);
    expect(canTransitionRequisition("submitted", "rejected")).toBe(true);
    expect(canTransitionRequisition("approved", "closed")).toBe(true);
    expect(canTransitionRequisition("rejected", "draft")).toBe(true);
    expect(canTransitionRequisition("closed", "submitted")).toBe(false);
  });

  it("candidate transitions valid/invalid", () => {
    expect(canTransitionCandidate("applied", "screening")).toBe(true);
    expect(canTransitionCandidate("applied", "rejected")).toBe(true);
    expect(canTransitionCandidate("screening", "offer_made")).toBe(true);
    expect(canTransitionCandidate("offer_made", "accepted")).toBe(true);
    expect(canTransitionCandidate("rejected", "screening")).toBe(false);
    expect(canTransitionCandidate("accepted", "rejected")).toBe(false);
  });

  it("interview overlap detection", () => {
    const aStart = new Date("2026-01-01T09:00:00Z");
    const aEnd = new Date("2026-01-01T10:00:00Z");
    const bStart = new Date("2026-01-01T09:30:00Z");
    const bEnd = new Date("2026-01-01T10:30:00Z");
    expect(hasInterviewOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
    const cStart = new Date("2026-01-01T10:00:00Z");
    const cEnd = new Date("2026-01-01T11:00:00Z");
    expect(hasInterviewOverlap(aStart, aEnd, cStart, cEnd)).toBe(false); // touching
    expect(hasInterviewOverlap(cStart, cEnd, aStart, aEnd)).toBe(false);
  });

  it("status enums contain expected values", () => {
    expect(REQUISITION_STATUSES).toContain("submitted");
    expect(REQUISITION_STATUSES).toContain("approved");
    expect(CANDIDATE_STATUSES).toContain("offer_made");
    expect(INTERVIEW_STATUSES).toContain("no_show");
  });
});
