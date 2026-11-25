"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  AlertCircle,
  FileEdit,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: string;
  createdAt: string;
}

interface AttendanceCorrection {
  id: string;
  attendanceDayId: string;
  reason: string;
  proposedCheckIn?: string | null;
  proposedCheckOut?: string | null;
  status: string;
  createdAt: string;
}

export function AttendancePage() {
  const [status, setStatus] = useState<string>("not_checked_in");
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [punching, setPunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    proposedCheckIn: "09:00",
    proposedCheckOut: "18:00",
    reason: "",
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/attendance/summary");
      if (!res.ok) throw new Error("Failed to load attendance records");
      const data = await res.json();
      setStatus(data.status);
      setTodayRecord(data.todayRecord);
      setHistory(data.history ?? []);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handlePunch = async (action: "check_in" | "check_out") => {
    setPunching(true);
    setError(null);
    try {
      const res = await fetch("/api/time/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Punch failed");
      await fetchAttendance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPunching(false);
    }
  };

  const handleOpenCorrection = (rec: AttendanceRecord) => {
    setSelectedDay(rec);
    setCorrectionForm({
      proposedCheckIn: rec.checkInAt ? rec.checkInAt.slice(11, 16) : "09:00",
      proposedCheckOut: rec.checkOutAt ? rec.checkOutAt.slice(11, 16) : "18:00",
      reason: "",
    });
    setShowCorrectionModal(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;
    setSubmittingCorrection(true);
    setError(null);
    try {
      const dateStr = selectedDay.workDate.slice(0, 10);
      const checkInIso = new Date(`${dateStr}T${correctionForm.proposedCheckIn}:00Z`).toISOString();
      const checkOutIso = new Date(`${dateStr}T${correctionForm.proposedCheckOut}:00Z`).toISOString();

      const res = await fetch("/api/time/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDayId: selectedDay.id,
          proposedCheckIn: checkInIso,
          proposedCheckOut: checkOutIso,
          reason: correctionForm.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit correction");

      setShowCorrectionModal(false);
      await fetchAttendance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Calculate elapsed time if checked in today
  let elapsedFormatted = "00:00:00";
  if (status === "checked_in" && todayRecord?.checkInAt) {
    const startMs = new Date(todayRecord.checkInAt).getTime();
    const nowMs = now.getTime();
    const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const hrs = String(Math.floor(diffSec / 3600)).padStart(2, "0");
    const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, "0");
    const secs = String(diffSec % 60).padStart(2, "0");
    elapsedFormatted = `${hrs}:${mins}:${secs}`;
  }

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "checked_in":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Checked In</Badge>;
      case "checked_out":
        return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Checked Out</Badge>;
      case "leave":
        return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30">On Leave</Badge>;
      case "correction_requested":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Correction Requested</Badge>;
      default:
        return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30">Not Checked In</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance &amp; Workday Clock</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time check-in/out recording with server timestamp validation and audited corrections.
        </p>
      </div>

      {error && (
        <div className="alert alert-error flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Punch Widget */}
      <div className="panel p-6 bg-gradient-to-br from-card to-card/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                Today · {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </span>
              {getStatusBadge(status)}
            </div>
            <div className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-foreground tabular-nums">
              {now.toLocaleTimeString("en-US", { hour12: false })}
            </div>
            {status === "checked_in" && (
              <div className="text-xs font-mono text-emerald-500 flex items-center justify-center md:justify-start gap-1.5 tabular-nums">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Shift Duration: <span className="font-semibold">{elapsedFormatted}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {status !== "checked_in" && status !== "checked_out" && status !== "leave" && (
              <button
                onClick={() => handlePunch("check_in")}
                disabled={punching}
                className="btn btn-primary w-full sm:w-48 py-3.5 text-base flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500"
              >
                <LogIn className="w-5 h-5" />
                {punching ? "Punching..." : "Check In Now"}
              </button>
            )}

            {status === "checked_in" && (
              <button
                onClick={() => handlePunch("check_out")}
                disabled={punching}
                className="btn btn-primary w-full sm:w-48 py-3.5 text-base flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500"
              >
                <LogOut className="w-5 h-5" />
                {punching ? "Punching..." : "Check Out"}
              </button>
            )}

            {status === "checked_out" && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 text-center">
                Shift Complete for Today
              </div>
            )}

            {status === "leave" && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-purple-400 text-center">
                Scheduled on Approved Leave
              </div>
            )}

            {todayRecord && todayRecord.status !== "not_checked_in" && (
              <button
                onClick={() => handleOpenCorrection(todayRecord)}
                className="btn btn-outline w-full sm:w-auto text-xs py-3 px-4 flex items-center justify-center gap-1.5"
              >
                <FileEdit className="w-4 h-4" />
                Request Correction
              </button>
            )}
          </div>
        </div>

        {/* Today's Punch Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border/50 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">Check-in:</span>
            <div className="font-bold text-foreground mt-0.5">
              {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString("en-US", { hour12: false }) : "--:--:--"}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Check-out:</span>
            <div className="font-bold text-foreground mt-0.5">
              {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString("en-US", { hour12: false }) : "--:--:--"}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Work Schedule:</span>
            <div className="font-bold text-foreground mt-0.5">09:00 - 18:00 (Standard)</div>
          </div>
          <div>
            <span className="text-muted-foreground">Timezone:</span>
            <div className="font-bold text-foreground mt-0.5">UTC / Canonical</div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm text-foreground">Attendance Records (Past 30 Days)</h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{history.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-muted/40 border-b border-border/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground font-sans">
                    No past attendance records found.
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {rec.workDate.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString("en-US", { hour12: false }) : "--"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString("en-US", { hour12: false }) : "--"}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(rec.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenCorrection(rec)}
                        className="btn btn-outline text-xs py-1 px-2.5 hover:text-primary"
                      >
                        Correct
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Modal */}
      <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Attendance Correction</DialogTitle>
            <DialogDescription>
              Submit proposed punch times for manager audit and approval. Original punches are strictly preserved.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCorrectionSubmit} className="space-y-4 pt-2 font-mono">
            <div>
              <span className="text-xs text-muted-foreground">Work Date:</span>
              <div className="font-bold text-foreground">
                {selectedDay?.workDate.slice(0, 10)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground">Proposed Check-in</label>
                <input
                  type="time"
                  className="input w-full mt-1 text-sm"
                  value={correctionForm.proposedCheckIn}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, proposedCheckIn: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Proposed Check-out</label>
                <input
                  type="time"
                  className="input w-full mt-1 text-sm"
                  value={correctionForm.proposedCheckOut}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, proposedCheckOut: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase text-muted-foreground">Reason for Correction*</label>
              <textarea
                className="input w-full mt-1 font-sans text-sm h-20 resize-none"
                placeholder="e.g. Forgot to punch out due to client meeting..."
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="btn btn-outline"
                disabled={submittingCorrection}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingCorrection}>
                {submittingCorrection ? "Submitting..." : "Submit Correction"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
