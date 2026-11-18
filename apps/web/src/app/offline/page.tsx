"use client";

import React from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft, Calendar, ClipboardCheck } from "lucide-react";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 text-amber-400">
        <WifiOff className="w-10 h-10" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
        Offline Mode Active
      </h1>
      <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
        OpsEngine detected that your device has lost internet connectivity. You can still access
        cached operational resources or retry when reconnected.
      </p>

      <div className="flex flex-wrap gap-3 justify-center mb-10">
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-500/20"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Cached Shortcuts
        </h3>
        <div className="space-y-2">
          <Link
            href="/dashboard/attendance"
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/60 transition text-sm text-slate-300"
          >
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Attendance Check-in</span>
          </Link>
          <Link
            href="/dashboard/daily-plan"
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/60 transition text-sm text-slate-300"
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span>Today&apos;s Work Plan</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
