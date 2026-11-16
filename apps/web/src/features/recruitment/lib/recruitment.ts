export const REQUISITION_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "closed",
] as const;

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const CANDIDATE_STATUSES = [
  "applied",
  "screening",
  "rejected",
  "withdrawn",
  "offer_made",
  "accepted",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const INTERVIEW_TYPES = ["phone", "technical", "managerial", "hr"] as const;
export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export function canTransitionRequisition(
  from: RequisitionStatus,
  to: RequisitionStatus,
): boolean {
  const map: Record<RequisitionStatus, Set<RequisitionStatus>> = {
    draft: new Set(["submitted", "closed"]),
    submitted: new Set(["approved", "rejected", "draft"]),
    approved: new Set(["closed"]),
    rejected: new Set(["draft", "closed"]),
    closed: new Set([]),
  };
  return map[from]?.has(to) ?? false;
}

export function canTransitionCandidate(
  from: CandidateStatus,
  to: CandidateStatus,
): boolean {
  const map: Record<CandidateStatus, Set<CandidateStatus>> = {
    applied: new Set(["screening", "rejected", "withdrawn"]),
    screening: new Set(["offer_made", "rejected", "withdrawn"]),
    rejected: new Set([]),
    withdrawn: new Set([]),
    offer_made: new Set(["accepted", "rejected"]),
    accepted: new Set([]),
  };
  return map[from]?.has(to) ?? false;
}

export function hasInterviewOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
