import { createHash } from "node:crypto";

export type CourseCategory =
  | "compliance"
  | "technical"
  | "leadership"
  | "sales"
  | "domain";

export type EnrollmentType = "mandatory" | "self_enrolled" | "manager_assigned";

export type EnrollmentStatus =
  | "enrolled"
  | "in_progress"
  | "completed"
  | "expired"
  | "failed";

export type ProficiencyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type CertificationStatus =
  | "pending_verification"
  | "verified"
  | "expired"
  | "rejected";

export interface CourseProgressInput {
  currentStatus: EnrollmentStatus;
  currentProgress: number;
  newProgress: number;
  newScore?: number | null;
  passingScore: number;
  validityMonths?: number | null;
}

export interface CourseProgressResult {
  status: EnrollmentStatus;
  progressPercent: number;
  score: number | null;
  isPassed: boolean;
  completedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Pure domain logic: Evaluates course progress and test completion.
 */
export function evaluateCourseProgress(input: CourseProgressInput): CourseProgressResult {
  const progressPercent = Math.max(0, Math.min(100, Math.round(input.newProgress)));
  const score = input.newScore !== undefined && input.newScore !== null ? Number(input.newScore) : null;

  if (progressPercent >= 100) {
    if (score !== null) {
      if (score >= input.passingScore) {
        const completedAt = new Date();
        const expiresAt = input.validityMonths
          ? new Date(completedAt.getTime() + input.validityMonths * 30 * 24 * 60 * 60 * 1000)
          : null;
        return {
          status: "completed",
          progressPercent: 100,
          score,
          isPassed: true,
          completedAt,
          expiresAt,
        };
      } else {
        return {
          status: "failed",
          progressPercent: 100,
          score,
          isPassed: false,
          completedAt: null,
          expiresAt: null,
        };
      }
    } else {
      // 100% completion without dedicated quiz score counts as passed
      const completedAt = new Date();
      const expiresAt = input.validityMonths
        ? new Date(completedAt.getTime() + input.validityMonths * 30 * 24 * 60 * 60 * 1000)
        : null;
      return {
        status: "completed",
        progressPercent: 100,
        score: null,
        isPassed: true,
        completedAt,
        expiresAt,
      };
    }
  }

  if (progressPercent > 0) {
    return {
      status: "in_progress",
      progressPercent,
      score,
      isPassed: false,
      completedAt: null,
      expiresAt: null,
    };
  }

  return {
    status: "enrolled",
    progressPercent: 0,
    score: null,
    isPassed: false,
    completedAt: null,
    expiresAt: null,
  };
}

export interface CertificationProofInput {
  id: string;
  tenantId: string;
  employeeId: string;
  skillName: string;
  proficiencyLevel: string;
  issuingAuthority: string;
  credentialId?: string | null;
  issuedAt: Date | string;
  verifiedBy: string;
  verifiedAt: Date | string;
}

/**
 * Generates an immutable SHA-256 tamper-evident cryptographic hash for a verified skill certification.
 */
export function calculateCertificationIntegrityHash(input: CertificationProofInput): string {
  const canonicalString = [
    `TENANT:${input.tenantId}`,
    `CERT:${input.id}`,
    `EMP:${input.employeeId}`,
    `SKILL:${input.skillName.trim().toLowerCase()}`,
    `LEVEL:${input.proficiencyLevel.trim().toLowerCase()}`,
    `AUTH:${input.issuingAuthority.trim()}`,
    `CRED:${input.credentialId ? input.credentialId.trim() : "NONE"}`,
    `VERIFIER:${input.verifiedBy}`,
    `VERIFIED_AT:${new Date(input.verifiedAt).toISOString()}`,
  ].join("|");

  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Validates whether a certification's stored hash matches the canonical hash.
 */
export function verifyCertificationIntegrity(
  input: CertificationProofInput,
  expectedHash: string
): boolean {
  if (!expectedHash || expectedHash.length !== 64) {
    return false;
  }
  const actualHash = calculateCertificationIntegrityHash(input);
  return actualHash === expectedHash;
}

export interface ComplianceCheckEnrollment {
  id: string;
  employeeId: string;
  courseId: string;
  courseTitle?: string;
  status: string;
  expiresAt?: Date | string | null;
}

export interface ComplianceStatusReport {
  total: number;
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  flaggedEnrollments: Array<{
    enrollmentId: string;
    employeeId: string;
    courseId: string;
    courseTitle?: string;
    status: "EXPIRED" | "EXPIRING_SOON";
    daysRemaining: number;
  }>;
}

/**
 * Audits compliance enrollments and identifies certifications nearing expiration or expired.
 */
export function checkComplianceExpirations(
  enrollments: ComplianceCheckEnrollment[],
  referenceDate: Date = new Date(),
  warningDays: number = 30
): ComplianceStatusReport {
  let activeCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  const flaggedEnrollments: ComplianceStatusReport["flaggedEnrollments"] = [];

  const refTime = referenceDate.getTime();
  const warningWindowMs = warningDays * 24 * 60 * 60 * 1000;

  for (const enr of enrollments) {
    if (enr.status !== "completed") {
      continue;
    }

    if (!enr.expiresAt) {
      activeCount++;
      continue;
    }

    const expTime = new Date(enr.expiresAt).getTime();
    const diffMs = expTime - refTime;
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= 0) {
      expiredCount++;
      flaggedEnrollments.push({
        enrollmentId: enr.id,
        employeeId: enr.employeeId,
        courseId: enr.courseId,
        courseTitle: enr.courseTitle,
        status: "EXPIRED",
        daysRemaining,
      });
    } else if (diffMs <= warningWindowMs) {
      expiringSoonCount++;
      flaggedEnrollments.push({
        enrollmentId: enr.id,
        employeeId: enr.employeeId,
        courseId: enr.courseId,
        courseTitle: enr.courseTitle,
        status: "EXPIRING_SOON",
        daysRemaining,
      });
    } else {
      activeCount++;
    }
  }

  return {
    total: enrollments.length,
    activeCount,
    expiringSoonCount,
    expiredCount,
    flaggedEnrollments,
  };
}

export interface CertificationRecord {
  id: string;
  employeeId: string;
  skillName: string;
  proficiencyLevel: ProficiencyLevel;
  status: CertificationStatus;
  issuedAt: Date | string;
  expiresAt?: Date | string | null;
}

export interface SkillMatrixSummary {
  skills: Array<{
    skillName: string;
    totalCertified: number;
    breakdown: {
      beginner: number;
      intermediate: number;
      advanced: number;
      expert: number;
    };
    employees: Array<{
      employeeId: string;
      level: ProficiencyLevel;
      certId: string;
    }>;
  }>;
  employees: Array<{
    employeeId: string;
    verifiedSkillsCount: number;
    skills: Array<{
      skillName: string;
      level: ProficiencyLevel;
    }>;
  }>;
}

/**
 * Aggregates verified skill certifications into an enterprise skill matrix.
 */
export function aggregateSkillMatrix(certifications: CertificationRecord[]): SkillMatrixSummary {
  const verifiedCerts = certifications.filter((c) => c.status === "verified");

  const skillMap = new Map<
    string,
    {
      breakdown: { beginner: number; intermediate: number; advanced: number; expert: number };
      employees: Array<{ employeeId: string; level: ProficiencyLevel; certId: string }>;
    }
  >();

  const employeeMap = new Map<
    string,
    Map<string, ProficiencyLevel>
  >();

  for (const cert of verifiedCerts) {
    const skillNorm = cert.skillName.trim();
    if (!skillMap.has(skillNorm)) {
      skillMap.set(skillNorm, {
        breakdown: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
        employees: [],
      });
    }

    const sEntry = skillMap.get(skillNorm)!;
    const level = (cert.proficiencyLevel || "intermediate") as ProficiencyLevel;
    if (sEntry.breakdown[level] !== undefined) {
      sEntry.breakdown[level]++;
    }
    sEntry.employees.push({
      employeeId: cert.employeeId,
      level,
      certId: cert.id,
    });

    if (!employeeMap.has(cert.employeeId)) {
      employeeMap.set(cert.employeeId, new Map());
    }
    employeeMap.get(cert.employeeId)!.set(skillNorm, level);
  }

  const skills = Array.from(skillMap.entries()).map(([skillName, data]) => ({
    skillName,
    totalCertified: data.employees.length,
    breakdown: data.breakdown,
    employees: data.employees,
  }));

  const employees = Array.from(employeeMap.entries()).map(([employeeId, skillsMap]) => ({
    employeeId,
    verifiedSkillsCount: skillsMap.size,
    skills: Array.from(skillsMap.entries()).map(([skillName, level]) => ({
      skillName,
      level,
    })),
  }));

  return { skills, employees };
}
