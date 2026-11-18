export type SurveyCategory = "pulse" | "enps" | "onboarding" | "exit" | "general";
export type SurveyStatus = "draft" | "active" | "closed";
export type QuestionType = "nps_10" | "likert_5" | "choice" | "text";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  required?: boolean;
  options?: string[]; // For choice questions
}

export interface SurveyAnswer {
  questionId: string;
  score?: number | null; // For nps_10 (0-10) or likert_5 (1-5)
  selectedOption?: string | null;
  textAnswer?: string | null;
}

export interface EnpsSummary {
  enpsScore: number; // -100 to +100
  totalResponses: number;
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
}

/**
 * Calculates Employee Net Promoter Score (eNPS) from a series of 0-10 ratings.
 * Promoters: 9-10
 * Passives: 7-8
 * Detractors: 0-6
 * eNPS = % Promoters - % Detractors
 */
export function calculateEnpsScore(scores: number[]): EnpsSummary {
  const validScores = scores.filter((s) => typeof s === "number" && !isNaN(s) && s >= 0 && s <= 10);
  const total = validScores.length;

  if (total === 0) {
    return {
      enpsScore: 0,
      totalResponses: 0,
      promotersCount: 0,
      passivesCount: 0,
      detractorsCount: 0,
      promotersPct: 0,
      passivesPct: 0,
      detractorsPct: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const s of validScores) {
    if (s >= 9) {
      promoters++;
    } else if (s >= 7) {
      passives++;
    } else {
      detractors++;
    }
  }

  const promotersPct = Math.round((promoters / total) * 100);
  const passivesPct = Math.round((passives / total) * 100);
  const detractorsPct = Math.round((detractors / total) * 100);
  const enpsScore = Math.round(((promoters - detractors) / total) * 100);

  return {
    enpsScore,
    totalResponses: total,
    promotersCount: promoters,
    passivesCount: passives,
    detractorsCount: detractors,
    promotersPct,
    passivesPct,
    detractorsPct,
  };
}

export interface QuestionAnalytics {
  questionId: string;
  prompt: string;
  type: QuestionType;
  responsesCount: number;
  npsSummary?: EnpsSummary;
  likertAverage?: number;
  likertDistribution?: Record<number, number>; // 1 -> count, 2 -> count...
  choiceDistribution?: Record<string, number>;
  textResponses?: string[];
}

export interface SurveyAnalyticsResult {
  surveyId: string;
  totalSubmissions: number;
  overallEnps?: EnpsSummary | null;
  questionsAnalytics: QuestionAnalytics[];
}

/**
 * Aggregates all submitted responses across questions into a comprehensive analytics report.
 */
export function aggregateSurveyAnalytics(
  survey: { id: string; questions: SurveyQuestion[] },
  responses: Array<{ answers: SurveyAnswer[]; npsScore?: number | null }>
): SurveyAnalyticsResult {
  const allNpsScores: number[] = [];

  const questionMap = new Map<string, QuestionAnalytics>();

  for (const q of survey.questions) {
    questionMap.set(q.id, {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      responsesCount: 0,
      likertDistribution: q.type === "likert_5" ? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } : undefined,
      choiceDistribution: q.type === "choice" ? {} : undefined,
      textResponses: q.type === "text" ? [] : undefined,
    });
  }

  for (const resp of responses) {
    if (typeof resp.npsScore === "number") {
      allNpsScores.push(resp.npsScore);
    }

    if (!Array.isArray(resp.answers)) continue;

    for (const ans of resp.answers) {
      const qAnalytics = questionMap.get(ans.questionId);
      if (!qAnalytics) continue;

      qAnalytics.responsesCount++;

      if (qAnalytics.type === "nps_10" && typeof ans.score === "number") {
        allNpsScores.push(ans.score);
      } else if (qAnalytics.type === "likert_5" && typeof ans.score === "number") {
        const rating = Math.max(1, Math.min(5, Math.round(ans.score)));
        if (qAnalytics.likertDistribution) {
          qAnalytics.likertDistribution[rating] = (qAnalytics.likertDistribution[rating] || 0) + 1;
        }
      } else if (qAnalytics.type === "choice" && ans.selectedOption) {
        if (qAnalytics.choiceDistribution) {
          qAnalytics.choiceDistribution[ans.selectedOption] =
            (qAnalytics.choiceDistribution[ans.selectedOption] || 0) + 1;
        }
      } else if (qAnalytics.type === "text" && ans.textAnswer) {
        if (qAnalytics.textResponses) {
          qAnalytics.textResponses.push(ans.textAnswer.trim());
        }
      }
    }
  }

  // Finalize question metrics
  const questionsAnalytics: QuestionAnalytics[] = [];
  for (const q of survey.questions) {
    const qAnalytics = questionMap.get(q.id)!;

    if (qAnalytics.type === "likert_5" && qAnalytics.likertDistribution) {
      let sum = 0;
      let count = 0;
      for (let star = 1; star <= 5; star++) {
        const c = qAnalytics.likertDistribution[star] || 0;
        sum += star * c;
        count += c;
      }
      qAnalytics.likertAverage = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    } else if (qAnalytics.type === "nps_10") {
      const qScores: number[] = [];
      for (const resp of responses) {
        const ans = resp.answers?.find((a) => a.questionId === q.id);
        if (ans && typeof ans.score === "number") {
          qScores.push(ans.score);
        }
      }
      qAnalytics.npsSummary = calculateEnpsScore(qScores.length > 0 ? qScores : allNpsScores);
    }

    questionsAnalytics.push(qAnalytics);
  }

  const overallEnps = allNpsScores.length > 0 ? calculateEnpsScore(allNpsScores) : null;

  return {
    surveyId: survey.id,
    totalSubmissions: responses.length,
    overallEnps,
    questionsAnalytics,
  };
}

export interface EmployeeRecognitionRecord {
  id: string;
  senderId: string;
  recipientId: string;
  badgeId: string;
  pointsAwarded: number;
  createdAt: Date | string;
}

export interface EmployeePointsSummary {
  recipientId: string;
  totalPoints: number;
  totalRecognitionsReceived: number;
  badgeCounts: Record<string, number>;
}

/**
 * Aggregates reward points and badge counts received by an employee.
 */
export function aggregateEmployeeRewardPoints(
  employeeId: string,
  recognitions: EmployeeRecognitionRecord[]
): EmployeePointsSummary {
  const forEmp = recognitions.filter((r) => r.recipientId === employeeId);

  let totalPoints = 0;
  const badgeCounts: Record<string, number> = {};

  for (const r of forEmp) {
    totalPoints += r.pointsAwarded || 0;
    badgeCounts[r.badgeId] = (badgeCounts[r.badgeId] || 0) + 1;
  }

  return {
    recipientId: employeeId,
    totalPoints,
    totalRecognitionsReceived: forEmp.length,
    badgeCounts,
  };
}
