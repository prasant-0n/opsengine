import { describe, it, expect } from "vitest";
import {
  evaluateCourseProgress,
  calculateCertificationIntegrityHash,
  verifyCertificationIntegrity,
  checkComplianceExpirations,
  aggregateSkillMatrix,
  CertificationRecord,
} from "../features/lms/lib/lms-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";
import type { ResourceScope } from "../lib/permissions/scopes";

describe("Feature #44 — Learning Management System (LMS) & Skill Certifications", () => {
  describe("Domain Engine: Course Progress & Assessment Evaluation", () => {
    it("marks enrollment as 'enrolled' when initial progress is 0%", () => {
      const result = evaluateCourseProgress({
        currentStatus: "enrolled",
        currentProgress: 0,
        newProgress: 0,
        passingScore: 80,
      });

      expect(result.status).toBe("enrolled");
      expect(result.progressPercent).toBe(0);
      expect(result.isPassed).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it("transitions enrollment to 'in_progress' when progress is between 1% and 99%", () => {
      const result = evaluateCourseProgress({
        currentStatus: "enrolled",
        currentProgress: 0,
        newProgress: 45,
        passingScore: 80,
      });

      expect(result.status).toBe("in_progress");
      expect(result.progressPercent).toBe(45);
      expect(result.isPassed).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it("clamps negative progress to 0% and excess progress to 100%", () => {
      const negativeResult = evaluateCourseProgress({
        currentStatus: "enrolled",
        currentProgress: 0,
        newProgress: -15,
        passingScore: 80,
      });
      expect(negativeResult.progressPercent).toBe(0);

      const excessResult = evaluateCourseProgress({
        currentStatus: "in_progress",
        currentProgress: 50,
        newProgress: 140,
        newScore: 90,
        passingScore: 80,
      });
      expect(excessResult.progressPercent).toBe(100);
      expect(excessResult.status).toBe("completed");
    });

    it("completes course and calculates compliance expiration when score meets passing threshold", () => {
      const result = evaluateCourseProgress({
        currentStatus: "in_progress",
        currentProgress: 80,
        newProgress: 100,
        newScore: 88,
        passingScore: 80,
        validityMonths: 12,
      });

      expect(result.status).toBe("completed");
      expect(result.isPassed).toBe(true);
      expect(result.score).toBe(88);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify expiration is ~360 days in future
      const diffDays = Math.round(
        (result.expiresAt!.getTime() - result.completedAt!.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(360);
    });

    it("marks course as 'failed' when score falls below required passing score", () => {
      const result = evaluateCourseProgress({
        currentStatus: "in_progress",
        currentProgress: 90,
        newProgress: 100,
        newScore: 68,
        passingScore: 80,
        validityMonths: 12,
      });

      expect(result.status).toBe("failed");
      expect(result.isPassed).toBe(false);
      expect(result.score).toBe(68);
      expect(result.completedAt).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it("completes reading-only course without quiz score at 100% progress", () => {
      const result = evaluateCourseProgress({
        currentStatus: "in_progress",
        currentProgress: 50,
        newProgress: 100,
        passingScore: 80,
      });

      expect(result.status).toBe("completed");
      expect(result.isPassed).toBe(true);
      expect(result.score).toBeNull();
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("Cryptographic Proofs & Tamper-Evident Hashing", () => {
    const certSample = {
      id: "cert-uuid-001",
      tenantId: "tenant-uuid-aaa",
      employeeId: "emp-uuid-david",
      skillName: "AWS Certified Solutions Architect",
      proficiencyLevel: "advanced",
      issuingAuthority: "Amazon Web Services",
      credentialId: "AWS-PSA-10827",
      issuedAt: "2026-01-15T00:00:00.000Z",
      verifiedBy: "emp-uuid-elena",
      verifiedAt: "2026-11-18T05:10:00.000Z",
    };

    it("generates a deterministic 64-character hex SHA-256 hash", () => {
      const hash1 = calculateCertificationIntegrityHash(certSample);
      const hash2 = calculateCertificationIntegrityHash(certSample);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(verifyCertificationIntegrity(certSample, hash1)).toBe(true);
    });

    it("detects tampering when any certificate property is modified", () => {
      const canonicalHash = calculateCertificationIntegrityHash(certSample);

      const tamperedLevel = { ...certSample, proficiencyLevel: "expert" };
      expect(calculateCertificationIntegrityHash(tamperedLevel)).not.toBe(canonicalHash);
      expect(verifyCertificationIntegrity(tamperedLevel, canonicalHash)).toBe(false);

      const tamperedAuthority = { ...certSample, issuingAuthority: "Fake Authority" };
      expect(calculateCertificationIntegrityHash(tamperedAuthority)).not.toBe(canonicalHash);

      const tamperedVerifier = { ...certSample, verifiedBy: "emp-uuid-attacker" };
      expect(calculateCertificationIntegrityHash(tamperedVerifier)).not.toBe(canonicalHash);
    });

    it("rejects invalid or malformed hash comparisons safely", () => {
      expect(verifyCertificationIntegrity(certSample, "")).toBe(false);
      expect(verifyCertificationIntegrity(certSample, "invalid-short-hash")).toBe(false);
    });
  });

  describe("Compliance Audit & Expiration Tracker", () => {
    const refDate = new Date("2026-11-18T10:00:00Z");

    it("identifies active, expiring-soon, and expired compliance certifications", () => {
      const enrollments = [
        {
          id: "enr-1",
          employeeId: "emp-1",
          courseId: "crs-sec",
          status: "completed",
          expiresAt: "2026-12-05T10:00:00Z", // ~17 days -> Expiring Soon
        },
        {
          id: "enr-2",
          employeeId: "emp-2",
          courseId: "crs-sec",
          status: "completed",
          expiresAt: "2026-10-01T10:00:00Z", // Expired
        },
        {
          id: "enr-3",
          employeeId: "emp-3",
          courseId: "crs-sec",
          status: "completed",
          expiresAt: "2027-05-01T10:00:00Z", // Active (> 30 days)
        },
        {
          id: "enr-4",
          employeeId: "emp-4",
          courseId: "crs-k8s",
          status: "completed",
          expiresAt: null, // Non-expiring course -> Active
        },
        {
          id: "enr-5",
          employeeId: "emp-5",
          courseId: "crs-sec",
          status: "in_progress", // Incomplete -> ignored from compliance count
          expiresAt: null,
        },
      ];

      const report = checkComplianceExpirations(enrollments, refDate, 30);

      expect(report.total).toBe(5);
      expect(report.activeCount).toBe(2);
      expect(report.expiringSoonCount).toBe(1);
      expect(report.expiredCount).toBe(1);

      expect(report.flaggedEnrollments).toHaveLength(2);
      expect(report.flaggedEnrollments.find((f) => f.enrollmentId === "enr-2")?.status).toBe(
        "EXPIRED"
      );
      expect(report.flaggedEnrollments.find((f) => f.enrollmentId === "enr-1")?.status).toBe(
        "EXPIRING_SOON"
      );
    });
  });

  describe("Enterprise Skill Matrix Aggregation", () => {
    it("aggregates verified skills and groups competency levels correctly", () => {
      const certs: CertificationRecord[] = [
        {
          id: "cert-1",
          employeeId: "emp-david",
          skillName: "Kubernetes",
          proficiencyLevel: "expert",
          status: "verified",
          issuedAt: new Date(),
        },
        {
          id: "cert-2",
          employeeId: "emp-liam",
          skillName: "Kubernetes",
          proficiencyLevel: "advanced",
          status: "verified",
          issuedAt: new Date(),
        },
        {
          id: "cert-3",
          employeeId: "emp-maya",
          skillName: "React",
          proficiencyLevel: "expert",
          status: "verified",
          issuedAt: new Date(),
        },
        {
          id: "cert-4",
          employeeId: "emp-intern",
          skillName: "React",
          proficiencyLevel: "beginner",
          status: "pending_verification", // Not yet verified -> ignored
          issuedAt: new Date(),
        },
      ];

      const matrix = aggregateSkillMatrix(certs);

      expect(matrix.skills).toHaveLength(2);

      const k8s = matrix.skills.find((s) => s.skillName === "Kubernetes");
      expect(k8s).toBeDefined();
      expect(k8s?.totalCertified).toBe(2);
      expect(k8s?.breakdown.expert).toBe(1);
      expect(k8s?.breakdown.advanced).toBe(1);
      expect(k8s?.breakdown.beginner).toBe(0);

      const react = matrix.skills.find((s) => s.skillName === "React");
      expect(react?.totalCertified).toBe(1);

      expect(matrix.employees).toHaveLength(3);
    });
  });

  describe("ReBAC Permissions & Cross-Tenant Security", () => {
    const tenantA = "00000000-0000-4000-8000-0000000000aa";
    const tenantB = "00000000-0000-4000-8000-0000000000bb";

    const employeeCtx: AuthorizationContext = {
      userId: "user-dev1",
      employeeId: "emp-dev1",
      tenantId: tenantA,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.LMS_COURSE_READ, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.LMS_ENROLLMENT_MANAGE_SELF, scopeType: "SELF", scopeId: null, validTo: null },
      ],
      roles: [{ key: "employee", scopeType: "SELF", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    const hrLeadCtx: AuthorizationContext = {
      userId: "user-hr1",
      employeeId: "emp-hr1",
      tenantId: tenantA,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.LMS_COURSE_READ, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.LMS_COURSE_MANAGE, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.LMS_ENROLLMENT_MANAGE_TEAM, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.LMS_CERTIFICATION_VERIFY, scopeType: "TENANT", scopeId: null, validTo: null },
      ],
      roles: [{ key: "hr", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows HR lead to manage courses, but denies regular employee", () => {
      const resourceA = {
        tenantId: tenantA,
        owningEmployeeId: "emp-hr1",
        resourceType: "lms_course",
      };

      const hrDecision = authorize(hrLeadCtx, PERMISSIONS.LMS_COURSE_MANAGE, resourceA);
      expect(hrDecision.allowed).toBe(true);

      const empDecision = authorize(employeeCtx, PERMISSIONS.LMS_COURSE_MANAGE, resourceA);
      expect(empDecision.allowed).toBe(false);
    });

    it("enforces self-enrollment scope for regular employees", () => {
      const selfResource = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev1",
        resourceType: "lms_enrollment",
      };
      const peerResource = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev2",
        resourceType: "lms_enrollment",
      };

      const selfDecision = authorize(
        employeeCtx,
        PERMISSIONS.LMS_ENROLLMENT_MANAGE_SELF,
        selfResource
      );
      expect(selfDecision.allowed).toBe(true);

      const peerDecision = authorize(
        employeeCtx,
        PERMISSIONS.LMS_ENROLLMENT_MANAGE_SELF,
        peerResource
      );
      expect(peerDecision.allowed).toBe(false);
    });

    it("strictly isolates LMS courses and enrollments across tenant boundaries", () => {
      const tenantBResource = {
        tenantId: tenantB,
        owningEmployeeId: "emp-b-lead",
        resourceType: "lms_course",
      };

      const crossTenantRead = authorize(
        hrLeadCtx,
        PERMISSIONS.LMS_COURSE_READ,
        tenantBResource
      );
      expect(crossTenantRead.allowed).toBe(false);

      const crossTenantManage = authorize(
        hrLeadCtx,
        PERMISSIONS.LMS_COURSE_MANAGE,
        tenantBResource
      );
      expect(crossTenantManage.allowed).toBe(false);
    });
  });
});
