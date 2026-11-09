"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  AlertCircle,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
  leaveType?: {
    id: string;
    code: string;
    name: string;
    annualAllowance: number;
    isPaid: boolean;
  } | null;
}

interface LeaveRequestItem {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  leaveType?: {
    name: string;
    code: string;
    isPaid: boolean;
  } | null;
  employee?: {
    displayName: string;
    department: string;
    jobTitle: string;
  } | null;
}

export function LeavePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequestItem[]>([]);
  const [teamRequests, setTeamRequests] = useState<LeaveRequestItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<LeaveRequestItem[]>([]);
  const [activeTab, setActiveTab] = useState<"my_leaves" | "team_requests" | "calendar">("my_leaves");
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    isHalfDay: false,
    reason: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [balRes, reqRes] = await Promise.all([
        fetch("/api/leave/balances"),
        fetch("/api/leave/requests"),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData.balances ?? []);
        if (balData.balances?.length > 0 && !form.leaveTypeId) {
          setForm((f) => ({ ...f, leaveTypeId: balData.balances[0].leaveTypeId }));
        }
      }

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setMyRequests(reqData.requests ?? []);
      }

      // Try fetching team requests (allowed if manager/HR)
      const teamRes = await fetch("/api/leave/requests?view=team");
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamRequests(teamData.requests ?? []);
      }

      // Calendar
      const calRes = await fetch("/api/leave/calendar");
      if (calRes.ok) {
        const calData = await calRes.json();
        setCalendarEvents(calData.calendar ?? []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load leave records");
    } finally {
      setLoading(false);
    }
  }, [form.leaveTypeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply for leave");

      setShowApplyModal(false);
      setForm({
        leaveTypeId: balances[0]?.leaveTypeId || "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        isHalfDay: false,
        reason: "",
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async (id: string, decision: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/leave/requests/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update decision");
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      const res = await fetch(`/api/leave/requests/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel request");
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const selectedBalance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);

  const getStatusBadge = (status: LeaveRequestItem["status"]) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pending Review</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30">Rejected</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30">Cancelled</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage leave balances, apply for time off, and coordinate team coverage.
          </p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="btn btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Apply for Leave
        </button>
      </div>

      {error && (
        <div className="alert alert-error flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b) => (
          <div key={b.id} className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {b.leaveType?.code || "LEAVE"}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {b.leaveType?.isPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground mt-1">{b.leaveType?.name}</h3>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-bold font-mono text-primary">{b.availableDays}</span>
                <span className="text-xs text-muted-foreground ml-1">days left</span>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5 font-mono">
                <div>Allocated: {b.allocatedDays}d</div>
                <div>Used: {b.usedDays}d</div>
                {b.pendingDays > 0 && <div className="text-amber-400">Pending: {b.pendingDays}d</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-px">
        <button
          onClick={() => setActiveTab("my_leaves")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "my_leaves"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          My Leave History ({myRequests.length})
        </button>
        {teamRequests.length > 0 && (
          <button
            onClick={() => setActiveTab("team_requests")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === "team_requests"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Team Requests
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-primary/20 text-primary">
              {teamRequests.filter((r) => r.status === "pending").length}
            </span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("calendar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
            activeTab === "calendar"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Team Calendar ({calendarEvents.length})
        </button>
      </div>

      {/* Tab 1: My Leaves */}
      {activeTab === "my_leaves" && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs font-mono uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {myRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No leave requests found. Click &quot;Apply for Leave&quot; to submit one.
                    </td>
                  </tr>
                ) : (
                  myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {req.leaveType?.name || "Leave"}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        {req.startDate.slice(0, 10)} → {req.endDate.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4">
                        {req.daysCount} day{req.daysCount !== 1 ? "s" : ""}
                        {req.isHalfDay && " (Half)"}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground max-w-xs truncate">
                        {req.reason}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                      <td className="py-3.5 px-4 text-right">
                        {(req.status === "pending" || req.status === "approved") && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="btn btn-outline text-xs py-1 px-2.5 text-rose-400 hover:text-rose-300 border-rose-500/30"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Team Requests (Manager view) */}
      {activeTab === "team_requests" && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs font-mono uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Decide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {teamRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No team leave requests pending approval.
                    </td>
                  </tr>
                ) : (
                  teamRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4">
                        <div className="font-medium font-sans text-foreground">
                          {req.employee?.displayName || "Employee"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {req.employee?.jobTitle} · {req.employee?.department}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">{req.leaveType?.name}</td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {req.startDate.slice(0, 10)} → {req.endDate.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4">{req.daysCount}d</td>
                      <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground max-w-xs truncate">
                        {req.reason}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                      <td className="py-3.5 px-4 text-right">
                        {req.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleDecide(req.id, "approve")}
                              className="btn btn-primary text-xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecide(req.id, "reject")}
                              className="btn btn-outline text-xs py-1 px-2.5 text-rose-400 hover:text-rose-300 border-rose-500/30"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-sans">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Team Calendar */}
      {activeTab === "calendar" && (
        <div className="panel p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            <span>Upcoming approved team leaves for this month</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
            {calendarEvents.length === 0 ? (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                No approved leaves scheduled for the team this month.
              </div>
            ) : (
              calendarEvents.map((ev) => (
                <div key={ev.id} className="p-3.5 rounded-lg bg-card/60 border border-border/60 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase leading-none">
                      {new Date(ev.startDate).toLocaleString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold text-primary leading-none mt-0.5">
                      {new Date(ev.startDate).getUTCDate()}
                    </span>
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-medium font-sans text-sm text-foreground truncate">
                      {ev.employee?.displayName}
                    </div>
                    <div className="text-xs text-primary font-mono mt-0.5">
                      {ev.leaveType?.name} ({ev.daysCount}d)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {ev.startDate.slice(0, 10)} → {ev.endDate.slice(0, 10)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Submit a formal time-off request for manager approval.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApply} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Leave Type*</label>
              <select
                className="input w-full mt-1 font-mono text-sm"
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
              >
                {balances.map((b) => (
                  <option key={b.leaveTypeId} value={b.leaveTypeId}>
                    {b.leaveType?.name} ({b.availableDays} days left)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground">Start Date*</label>
                <input
                  type="date"
                  className="input w-full mt-1 font-mono text-sm"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground">End Date*</label>
                <input
                  type="date"
                  className="input w-full mt-1 font-mono text-sm"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isHalfDay"
                checked={form.isHalfDay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isHalfDay: e.target.checked,
                    endDate: e.target.checked ? form.startDate : form.endDate,
                  })
                }
                className="checkbox"
              />
              <label htmlFor="isHalfDay" className="text-xs font-mono text-foreground cursor-pointer">
                Half-Day Leave (0.5 days)
              </label>
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Reason*</label>
              <textarea
                className="input w-full mt-1 font-sans text-sm h-20 resize-none"
                placeholder="Reason for time-off request..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>

            {selectedBalance && (
              <div className="p-3 rounded-lg bg-card border border-border/60 text-xs font-mono flex items-center justify-between text-muted-foreground">
                <span>Available Balance:</span>
                <span className="font-bold text-foreground">{selectedBalance.availableDays} days</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="btn btn-outline"
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
