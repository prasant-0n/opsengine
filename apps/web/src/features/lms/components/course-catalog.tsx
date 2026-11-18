"use client";

import React, { useState } from "react";
import { BookOpen, Clock, Award, ShieldCheck, CheckCircle2, Search } from "lucide-react";

export interface CourseItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  passingScore: number;
  durationMinutes: number;
  validityMonths?: number | null;
  modules?: any[];
  isActive: boolean;
}

interface CourseCatalogProps {
  courses: CourseItem[];
  enrolledCourseIds: Set<string>;
  onEnroll: (courseId: string) => Promise<void>;
  isLoading?: boolean;
}

export function CourseCatalog({
  courses,
  enrolledCourseIds,
  onEnroll,
  isLoading,
}: CourseCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const categories = ["all", "compliance", "technical", "leadership", "sales", "domain"];

  const filteredCourses = courses.filter((course) => {
    const matchesCategory =
      selectedCategory === "all" || course.category.toLowerCase() === selectedCategory;
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEnrollClick = async (courseId: string) => {
    setEnrollingId(courseId);
    try {
      await onEnroll(courseId);
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <BookOpen className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-lg font-medium text-slate-300">No courses found</h3>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting your search query or category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const isEnrolling = enrollingId === course.id;

            return (
              <div
                key={course.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 font-semibold">
                      {course.code}
                    </span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {course.category}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100 mb-2 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 mb-4">
                    {course.description}
                  </p>
                </div>

                <div className="space-y-4 pt-3 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>{course.durationMinutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-slate-500" />
                      <span>Pass: {course.passingScore}%</span>
                    </div>
                    {course.validityMonths && (
                      <div className="col-span-2 flex items-center gap-1.5 text-amber-400/90">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Recurring ({course.validityMonths} months)</span>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={isEnrolled || isEnrolling || isLoading}
                    onClick={() => handleEnrollClick(course.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                      isEnrolled
                        ? "bg-slate-800 text-slate-400 cursor-default"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                    }`}
                  >
                    {isEnrolled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Enrolled</span>
                      </>
                    ) : isEnrolling ? (
                      <span>Enrolling...</span>
                    ) : (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Enroll Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
