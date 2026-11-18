export const APPRAISAL_CYCLE_STATUSES = [
  "planning",
  "active",
  "calibration",
  "closed",
] as const;

export type AppraisalCycleStatus = (typeof APPRAISAL_CYCLE_STATUSES)[number];

export const APPRAISAL_REVIEW_TYPES = [
  "self",
  "manager",
  "peer",
  "upward",
] as const;

export type AppraisalReviewType = (typeof APPRAISAL_REVIEW_TYPES)[number];

export const REVIEW_STATUSES = [
  "draft",
  "submitted",
  "calibrated",
  "acknowledged",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const RECOMMENDATIONS = [
  "none",
  "promotion",
  "compensation_increase",
  "pip",
] as const;

export type AppraisalRecommendation = (typeof RECOMMENDATIONS)[number];

export interface CompetencyScore {
  technical?: number;
  delivery?: number;
  collaboration?: number;
  ownership?: number;
  leadership?: number;
}

export interface ReviewScoreInput {
  reviewType: AppraisalReviewType;
  overallRating: number; // 1.0 - 5.0
}

export interface CompositeScoreResult {
  finalScore: number; // 1.0 - 5.0
  performanceBand: string; // e.g. "Exceeds Expectations"
  breakdown: {
    managerScore: number | null;
    selfScore: number | null;
    peerScore: number | null;
    okrScoreNormalized: number; // 1.0 - 5.0
  };
}

/**
 * Calculates weighted composite score from 360-degree reviews and OKR performance.
 * Standard corporate distribution weights:
 * - Manager Evaluation: 50%
 * - Self Assessment: 15%
 * - Peer Reviews: 20%
 * - Objective & Key Results (OKR): 15%
 */
export function calculateCompositeAppraisalScore(
  reviews: ReviewScoreInput[],
  okrProgressPercent: number
): CompositeScoreResult {
  const managerReviews = reviews.filter((r) => r.reviewType === "manager");
  const selfReviews = reviews.filter((r) => r.reviewType === "self");
  const peerReviews = reviews.filter((r) => r.reviewType === "peer" || r.reviewType === "upward");

  const avg = (arr: ReviewScoreInput[]) =>
    arr.length ? arr.reduce((acc, r) => acc + r.overallRating, 0) / arr.length : null;

  const managerAvg = avg(managerReviews);
  const selfAvg = avg(selfReviews);
  const peerAvg = avg(peerReviews);

  // Normalize OKR progress (0-100%) to a 1.0 - 5.0 rating scale
  // 0% -> 1.0, 50% -> 3.0, 100% -> 5.0
  const clampedOkr = Math.max(0, Math.min(100, okrProgressPercent));
  const okrScoreNormalized = 1.0 + (clampedOkr / 100) * 4.0;

  let totalWeight = 0;
  let weightedSum = 0;

  if (managerAvg !== null) {
    weightedSum += managerAvg * 0.5;
    totalWeight += 0.5;
  }
  if (selfAvg !== null) {
    weightedSum += selfAvg * 0.15;
    totalWeight += 0.15;
  }
  if (peerAvg !== null) {
    weightedSum += peerAvg * 0.2;
    totalWeight += 0.2;
  }

  weightedSum += okrScoreNormalized * 0.15;
  totalWeight += 0.15;

  const rawFinal = totalWeight > 0 ? weightedSum / totalWeight : 3.0;
  const finalScore = Math.round(rawFinal * 10) / 10; // Round to 1 decimal place

  let performanceBand = "Meets Expectations";
  if (finalScore >= 4.5) performanceBand = "Exceptional / Far Exceeds";
  else if (finalScore >= 3.8) performanceBand = "Exceeds Expectations";
  else if (finalScore >= 2.8) performanceBand = "Consistently Delivers / Meets Expectations";
  else if (finalScore >= 2.0) performanceBand = "Needs Improvement";
  else performanceBand = "Unsatisfactory / Critical Gap";

  return {
    finalScore,
    performanceBand,
    breakdown: {
      managerScore: managerAvg !== null ? Math.round(managerAvg * 10) / 10 : null,
      selfScore: selfAvg !== null ? Math.round(selfAvg * 10) / 10 : null,
      peerScore: peerAvg !== null ? Math.round(peerAvg * 10) / 10 : null,
      okrScoreNormalized: Math.round(okrScoreNormalized * 10) / 10,
    },
  };
}

/**
 * Calculates aggregate OKR progress percentage across child key results.
 */
export function calculateOkrProgress(
  keyResults: Array<{ targetValue: number; currentValue: number }>
): number {
  if (!keyResults.length) return 0.0;

  const totalProgress = keyResults.reduce((acc, kr) => {
    if (kr.targetValue <= 0) return acc;
    const itemProgress = Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100));
    return acc + itemProgress;
  }, 0);

  return Math.round((totalProgress / keyResults.length) * 10) / 10;
}

/**
 * Validates state transitions for Appraisal Cycles.
 */
export function canTransitionCycle(
  current: AppraisalCycleStatus,
  next: AppraisalCycleStatus
): boolean {
  const allowed: Record<AppraisalCycleStatus, AppraisalCycleStatus[]> = {
    planning: ["active"],
    active: ["calibration", "planning"],
    calibration: ["closed", "active"],
    closed: [], // Final immutable state
  };

  return allowed[current]?.includes(next) ?? false;
}

/**
 * Analyzes bell-curve distribution across calibrated employee ratings.
 */
export function evaluateCalibrationDistribution(ratings: number[]): {
  count: number;
  average: number;
  distribution: {
    band5_exceptional: number;
    band4_exceeds: number;
    band3_meets: number;
    band2_needs_improvement: number;
    band1_unsatisfactory: number;
  };
} {
  const count = ratings.length;
  if (!count) {
    return {
      count: 0,
      average: 0,
      distribution: {
        band5_exceptional: 0,
        band4_exceeds: 0,
        band3_meets: 0,
        band2_needs_improvement: 0,
        band1_unsatisfactory: 0,
      },
    };
  }

  const sum = ratings.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / count) * 10) / 10;

  const counts = {
    band5_exceptional: ratings.filter((r) => r >= 4.5).length,
    band4_exceeds: ratings.filter((r) => r >= 3.8 && r < 4.5).length,
    band3_meets: ratings.filter((r) => r >= 2.8 && r < 3.8).length,
    band2_needs_improvement: ratings.filter((r) => r >= 2.0 && r < 2.8).length,
    band1_unsatisfactory: ratings.filter((r) => r < 2.0).length,
  };

  return {
    count,
    average,
    distribution: {
      band5_exceptional: Math.round((counts.band5_exceptional / count) * 100),
      band4_exceeds: Math.round((counts.band4_exceeds / count) * 100),
      band3_meets: Math.round((counts.band3_meets / count) * 100),
      band2_needs_improvement: Math.round((counts.band2_needs_improvement / count) * 100),
      band1_unsatisfactory: Math.round((counts.band1_unsatisfactory / count) * 100),
    },
  };
}
