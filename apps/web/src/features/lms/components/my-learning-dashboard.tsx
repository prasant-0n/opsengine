"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  PlayCircle,
  CheckCircle,
  AlertTriangle,
  Clock,
  Award,
  ChevronRight,
} from "lucide-react";
import { CourseItem } from "./course-catalog";

export interface EnrollmentItem {
  id: string;
  courseId: string;
  employeeId: string;
  enrollmentType: string;
  status: "enrolled" | "in_progress" | "completed" | "expired" | "failed";
  progressPercent: number;
  score?: number | null;
  enrolledAt: string;
  completedAt?: string | null;
  expiresAt?: string | null;
}

interface MyLearningDashboardProps {
  enrollments: EnrollmentItem[];
  courses: Map<string, CourseItem>;
  onUpdateProgress: (enrollmentId: string, progress: number, score?: number) => Promise<void>;
  isLoading?: boolean;
}

export function MyLearningDashboard({
  enrollments,
  courses,
  onUpdateProgress,
  isLoading,
}: MyLearningDashboardProps) {
  const [activeModalEnrollment, setActiveModalEnrollment] = useState<EnrollmentItem | null>(null);
  const [modalProgress, setModalProgress] = useState<number>(100);
  const [modalScore, setModalScore] = useState<number>(85);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (enr: EnrollmentItem) => {
    setActiveModalEnrollment(enr);
    setModalProgress(enr.progressPercent < 100 ? 100 : enr.progressPercent);
    setModalScore(enr.score ?? 85);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalEnrollment) return;
    setIsSubmitting(true);
    try {
      await onUpdateProgress(activeModalEnrollment.id, modalProgress, modalScore);
      setActiveModalEnrollment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: EnrollmentItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle className="h-3 w-3" /> Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
            <PlayCircle className="h-3 w-3" /> In Progress
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
            <AlertTriangle className="h-3 w-3" /> Failed
          </span>
        );
      case "expired":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
            <Clock className="h-3 w-3" /> Expired
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Enrolled
          </span>
        );
    }
  };

  if (enrollments.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
        <GraduationCap className="mx-auto h-12 w-12 text-slate-600 mb-3" />
        <h3 className="text-lg font-medium text-slate-300">No active course enrollments</h3>
        <p className="text-sm text-slate-500 mt-1">
          Explore the course catalog to enroll in compliance and technical training programs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {enrollments.map((enr) => {
          const course = courses.get(enr.courseId);
          const title = course ? course.title : `Course (${enr.courseId.slice(0, 8)})`;
          const code = course ? course.code : "CRS";
          const passingScore = course?.passingScore ?? 80;

          return (
            <div
              key={enr.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {code}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
                  {getStatusBadge(enr.status)}
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-md space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span>{enr.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        enr.status === "completed"
                          ? "bg-emerald-500"
                          : enr.status === "failed"
                          ? "bg-red-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${enr.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                  {enr.score !== undefined && enr.score !== null && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Award className="h-3.5 w-3.5 text-amber-400" />
                      Score: {enr.score}% (Pass: {passingScore}%)
                    </span>
                  )}
                  {enr.expiresAt && (
                    <span className="flex items-center gap-1 text-amber-400/90">
                      <Clock className="h-3.5 w-3.5" />
                      Valid until: {new Date(enr.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  <span>Enrolled: {new Date(enr.enrolledAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleOpenModal(enr)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <span>{enr.status === "completed" ? "Retake Assessment" : "Update Progress"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress update modal */}
      {activeModalEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Submit Course Progress & Score
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Simulate completing module content and taking the assessment.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Progress Percentage ({modalProgress}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={modalProgress}
                  onChange={(e) => setModalProgress(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assessment Quiz Score (0 - 100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={modalScore}
                  onChange={(e) => setModalScore(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalEnrollment(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit Progress"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
