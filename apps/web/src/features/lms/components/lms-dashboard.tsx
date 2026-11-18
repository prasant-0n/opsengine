"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CourseCatalog, CourseItem } from "./course-catalog";
import { MyLearningDashboard, EnrollmentItem } from "./my-learning-dashboard";
import { SkillMatrixBoard, SkillCertItem } from "./skill-matrix-board";
import { CertificationSubmissionModal } from "./certification-submission-modal";
import {
  GraduationCap,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export function LmsDashboard() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [certifications, setCertifications] = useState<SkillCertItem[]>([]);
  const [activeTab, setActiveTab] = useState<"catalog" | "my-learning" | "matrix">("catalog");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [coursesRes, enrollmentsRes, certsRes] = await Promise.all([
        fetch("/api/lms/courses"),
        fetch("/api/lms/enrollments"),
        fetch("/api/lms/certifications"),
      ]);

      if (coursesRes.ok) {
        const cData = await coursesRes.json();
        setCourses(cData.data || []);
      }
      if (enrollmentsRes.ok) {
        const eData = await enrollmentsRes.json();
        setEnrollments(eData.data || []);
      }
      if (certsRes.ok) {
        const crtData = await certsRes.json();
        setCertifications(crtData.data || []);
      }
    } catch (err) {
      console.error("Failed to load LMS data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const courseMap = useMemo(() => {
    const map = new Map<string, CourseItem>();
    for (const c of courses) {
      map.set(c.id, c);
    }
    return map;
  }, [courses]);

  const enrolledCourseIds = useMemo(() => {
    return new Set(enrollments.map((e) => e.courseId));
  }, [enrollments]);

  const handleEnroll = async (courseId: string) => {
    try {
      const res = await fetch("/api/lms/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (res.ok) {
        setStatusMessage("Enrolled in course successfully!");
        await loadData();
        setActiveTab("my-learning");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to enroll");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const handleUpdateProgress = async (enrollmentId: string, progress: number, score?: number) => {
    try {
      const res = await fetch(`/api/lms/enrollments/${enrollmentId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPercent: progress, score }),
      });
      if (res.ok) {
        setStatusMessage("Progress updated successfully!");
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update progress");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const handleSubmitCert = async (data: any) => {
    const res = await fetch("/api/lms/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit certification");
    }
    setStatusMessage("Certification submitted for verification!");
    await loadData();
    setActiveTab("matrix");
  };

  const handleVerifyCert = async (certId: string, action: "verify" | "reject") => {
    const res = await fetch(`/api/lms/certifications/${certId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setStatusMessage(`Certification ${action === "verify" ? "verified" : "rejected"}!`);
      await loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to verify certification");
    }
  };

  const completedEnrollments = enrollments.filter((e) => e.status === "completed");
  const inProgressEnrollments = enrollments.filter((e) => e.status === "in_progress" || e.status === "enrolled");
  const verifiedCerts = certifications.filter((c) => c.status === "verified");

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-slate-100">
      {/* Back button and page title */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <GraduationCap className="h-7 w-7 text-blue-400" />
              <span>Learning & Skill Certifications</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Curriculum training tracks, statutory compliance verifications, and cryptographic skill matrix.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Award className="h-4 w-4" />
              <span>Submit Skill Proof</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Available Courses</span>
            <BookOpen className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{courses.length}</p>
          <span className="text-[11px] text-slate-500">Across 5 competency domains</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Learning</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{inProgressEnrollments.length}</p>
          <span className="text-[11px] text-slate-500">In-progress curriculum</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Completed Courses</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{completedEnrollments.length}</p>
          <span className="text-[11px] text-slate-500">Passed assessments</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Verified Skills</span>
            <Sparkles className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{verifiedCerts.length}</p>
          <span className="text-[11px] text-slate-500">Cryptographically signed proofs</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-b border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "catalog"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Course Catalog</span>
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {courses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("my-learning")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "my-learning"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          <span>My Learning & Assessments</span>
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {enrollments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "matrix"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Skill Matrix & Cryptographic Proofs</span>
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {certifications.length}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "catalog" && (
          <CourseCatalog
            courses={courses}
            enrolledCourseIds={enrolledCourseIds}
            onEnroll={handleEnroll}
            isLoading={isLoading}
          />
        )}

        {activeTab === "my-learning" && (
          <MyLearningDashboard
            enrollments={enrollments}
            courses={courseMap}
            onUpdateProgress={handleUpdateProgress}
            isLoading={isLoading}
          />
        )}

        {activeTab === "matrix" && (
          <SkillMatrixBoard
            certifications={certifications}
            onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
            onVerifyCert={handleVerifyCert}
            isManager={true}
          />
        )}
      </div>

      {/* Modal */}
      <CertificationSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmit={handleSubmitCert}
      />
    </div>
  );
}
