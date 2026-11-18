"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  ShieldCheck,
  History,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ExecutiveSummaryData {
  workforce: {
    totalEmployees: number;
    departmentBreakdown: Array<{ department: string; count: number }>;
    todayAttended: number;
    todayOnLeave: number;
    attendanceRatePct: number;
  };
  delivery: {
    activeProjects: number;
    openTickets: number;
    resolvedTickets: number;
    completionRatePct: number;
  };
  sales: {
    totalOpportunities: number;
    totalPipelineCents: number;
    openLeads: number;
  };
  finance: {
    totalInvoices: number;
    totalBilledCents: number;
    unpaidReceivables: number;
  };
  talent: {
    openRequisitions: number;
    activeOnboarding: number;
  };
  governance: {
    pendingApprovals: number;
    totalAuditEvents: number;
  };
}

interface AuditEvent {
  id: string;
  tenantId: string;
  actorUserId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision: string;
  reasonCode?: string | null;
  policyVersion?: string | null;
  metadata?: any;
  createdAt: string;
}

interface StageHistoryItem {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  fromStatus?: string | null;
  toStatus: string;
  actorId?: string | null;
  reason?: string | null;
  createdAt: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "audit" | "governance">("overview");

  // Summary State
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Audit Events State
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState("");
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<string>("all");
  const [auditPage, setAuditPage] = useState(0);
  const auditPageSize = 25;

  // Stage History State
  const [stageHistory, setStageHistory] = useState<StageHistoryItem[]>([]);
  const [stageTotal, setStageTotal] = useState(0);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageEntityFilter, setStageEntityFilter] = useState("");
  const [stagePage, setStagePage] = useState(0);
  const stagePageSize = 25;

  // Fetch Executive Summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/reports/executive-summary");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch executive summary (${res.status})`);
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (e: any) {
      setSummaryError(e.message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch Audit Events
  const fetchAuditEvents = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams();
      if (auditEventTypeFilter.trim()) params.set("eventType", auditEventTypeFilter.trim());
      if (auditDecisionFilter !== "all") params.set("decision", auditDecisionFilter);
      params.set("limit", auditPageSize.toString());
      params.set("offset", (auditPage * auditPageSize).toString());

      const res = await fetch(`/api/reports/audit-events?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch audit events (${res.status})`);
      }
      const data = await res.json();
      setAuditEvents(data.events || []);
      setAuditTotal(data.total || 0);
    } catch (e: any) {
      setAuditError(e.message);
    } finally {
      setAuditLoading(false);
    }
  }, [auditEventTypeFilter, auditDecisionFilter, auditPage]);

  // Fetch Stage History
  const fetchStageHistory = useCallback(async () => {
    setStageLoading(true);
    setStageError(null);
    try {
      const params = new URLSearchParams();
      if (stageEntityFilter.trim()) params.set("entityType", stageEntityFilter.trim());
      params.set("limit", stagePageSize.toString());
      params.set("offset", (stagePage * stagePageSize).toString());

      const res = await fetch(`/api/reports/stage-history?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch stage history (${res.status})`);
      }
      const data = await res.json();
      setStageHistory(data.history || []);
      setStageTotal(data.total || 0);
    } catch (e: any) {
      setStageError(e.message);
    } finally {
      setStageLoading(false);
    }
  }, [stageEntityFilter, stagePage]);

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditEvents();
    } else if (activeTab === "governance") {
      fetchStageHistory();
    }
  }, [activeTab, fetchAuditEvents, fetchStageHistory]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (auditEventTypeFilter.trim()) params.set("eventType", auditEventTypeFilter.trim());
    if (auditDecisionFilter !== "all") params.set("decision", auditDecisionFilter);
    window.open(`/api/reports/audit-events/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="page-stack">
      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Executive Reports & Audit Logs</h1>
            <Badge variant="outline" className="text-xs">
              audit.read · Module 16
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise intelligence, ReBAC security audit trail, and governance stage timeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "audit" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "overview") fetchSummary();
              else if (activeTab === "audit") fetchAuditEvents();
              else fetchStageHistory();
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Executive Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Logs ({summary?.governance.totalAuditEvents ?? "…"})</span>
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "governance"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stage History</span>
        </button>
      </div>

      {/* Tab 1: Executive Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="panel p-8 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
              Loading real-time executive analytics…
            </div>
          ) : summaryError ? (
            <div className="panel p-6 border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 mb-1" />
              <p className="font-semibold">Failed to load analytics</p>
              <p className="text-sm opacity-90">{summaryError}</p>
            </div>
          ) : summary ? (
            <>
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Workforce Card */}
                <div className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Workforce & Operations</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{summary.workforce.totalEmployees}</div>
                    <div className="text-xs text-muted-foreground mt-1">Active Headcount</div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Today's Attendance:</span>
                      <span className="font-medium">{summary.workforce.todayAttended} present</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">On Leave:</span>
                      <span className="font-medium">{summary.workforce.todayOnLeave} away</span>
                    </div>
                    <div className="w-full bg-secondary/50 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, summary.workforce.attendanceRatePct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery & Projects Card */}
                <div className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Delivery & Engineering</span>
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{summary.delivery.activeProjects}</div>
                    <div className="text-xs text-muted-foreground mt-1">Active Projects</div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tickets Resolved:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {summary.delivery.resolvedTickets}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tickets Open:</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {summary.delivery.openTickets}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 font-semibold">
                      <span>Completion Rate:</span>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                        {summary.delivery.completionRatePct}%
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Sales & CRM Pipeline Card */}
                <div className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">CRM & Revenue Pipeline</span>
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                      {formatCurrency(summary.sales.totalPipelineCents)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Pipeline Volume</div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Opportunities:</span>
                      <span className="font-medium">{summary.sales.totalOpportunities}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Open Leads:</span>
                      <span className="font-medium">{summary.sales.openLeads}</span>
                    </div>
                  </div>
                </div>

                {/* Finance & Invoicing Card */}
                <div className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Finance & Receivables</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight">
                      {formatCurrency(summary.finance.totalBilledCents)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Total Invoiced</div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoices Generated:</span>
                      <span className="font-medium">{summary.finance.totalInvoices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unpaid Receivables:</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {summary.finance.unpaidReceivables}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Department Breakdown */}
                <div className="panel p-5 space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Department Distribution</span>
                  </h3>
                  {summary.workforce.departmentBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No departmental records found.</p>
                  ) : (
                    <div className="space-y-3">
                      {summary.workforce.departmentBreakdown.map((dept) => (
                        <div key={dept.department} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">{dept.department}</span>
                            <span className="text-muted-foreground">{dept.count} members</span>
                          </div>
                          <div className="w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{
                                width: `${Math.round(
                                  (dept.count / Math.max(1, summary.workforce.totalEmployees)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Talent & Recruitment */}
                <div className="panel p-5 space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Talent & Hiring Pipeline</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <div className="text-sm font-medium">Open Requisitions</div>
                        <div className="text-xs text-muted-foreground">Active job postings</div>
                      </div>
                      <div className="text-2xl font-bold">{summary.talent.openRequisitions}</div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <div className="text-sm font-medium">Active Onboarding</div>
                        <div className="text-xs text-muted-foreground">New hire plans in progress</div>
                      </div>
                      <div className="text-2xl font-bold">{summary.talent.activeOnboarding}</div>
                    </div>
                  </div>
                </div>

                {/* Governance & Compliance */}
                <div className="panel p-5 space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>Governance & Security Health</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <div className="text-sm font-medium">Pending Approvals</div>
                        <div className="text-xs text-muted-foreground">Awaiting stakeholder sign-off</div>
                      </div>
                      <Badge variant="outline" className="text-amber-500 font-bold">
                        {summary.governance.pendingApprovals}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <div className="text-sm font-medium">Audit Events Logged</div>
                        <div className="text-xs text-muted-foreground">Immutable authorization events</div>
                      </div>
                      <div className="text-2xl font-bold">{summary.governance.totalAuditEvents}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Tab 2: Audit Trail */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="panel p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by event type (e.g. auth, leave, ticket)..."
                  value={auditEventTypeFilter}
                  onChange={(e) => {
                    setAuditEventTypeFilter(e.target.value);
                    setAuditPage(0);
                  }}
                  className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={auditDecisionFilter}
                onChange={(e) => {
                  setAuditDecisionFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Decisions</option>
                <option value="allow">Allow only</option>
                <option value="deny">Deny only</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {auditEvents.length} of {auditTotal} recorded events
            </div>
          </div>

          {/* Table */}
          <div className="panel overflow-hidden">
            {auditLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                Loading audit trail…
              </div>
            ) : auditError ? (
              <div className="p-6 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 mb-1" />
                <span>{auditError}</span>
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No audit events found matching the criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Timestamp</th>
                      <th className="text-left">Event Type</th>
                      <th className="text-left">Decision</th>
                      <th className="text-left">Reason Code</th>
                      <th className="text-left">Resource</th>
                      <th className="text-left">Actor ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((ev) => (
                      <tr key={ev.id} className="border-b border-border/40 hover:bg-secondary/20 text-xs">
                        <td className="whitespace-nowrap font-mono text-muted-foreground">
                          {formatDate(ev.createdAt)}
                        </td>
                        <td className="font-semibold text-foreground">
                          <code>{ev.eventType}</code>
                        </td>
                        <td>
                          {ev.decision === "allow" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              allow
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              <XCircle className="w-3 h-3" />
                              deny
                            </span>
                          )}
                        </td>
                        <td className="font-mono text-muted-foreground">{ev.reasonCode || "—"}</td>
                        <td>
                          {ev.resourceType ? (
                            <span className="text-muted-foreground">
                              {ev.resourceType}
                              {ev.resourceId && (
                                <span className="opacity-70 font-mono text-[10px] block">
                                  {ev.resourceId.slice(0, 8)}…
                                </span>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="font-mono text-muted-foreground">
                          {ev.actorUserId ? ev.actorUserId.slice(0, 12) + "…" : "system"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {auditTotal > auditPageSize && (
              <div className="p-3 border-t border-border flex items-center justify-between text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage === 0}
                  onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {auditPage + 1} of {Math.ceil(auditTotal / auditPageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(auditPage + 1) * auditPageSize >= auditTotal}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Governance & Stage History */}
      {activeTab === "governance" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="panel p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by entity type (e.g. approval, attendance, requisition)..."
                value={stageEntityFilter}
                onChange={(e) => {
                  setStageEntityFilter(e.target.value);
                  setStagePage(0);
                }}
                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {stageHistory.length} of {stageTotal} stage transitions
            </div>
          </div>

          {/* Table */}
          <div className="panel overflow-hidden">
            {stageLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                Loading governance stage history…
              </div>
            ) : stageError ? (
              <div className="p-6 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 mb-1" />
                <span>{stageError}</span>
              </div>
            ) : stageHistory.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No stage transitions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Timestamp</th>
                      <th className="text-left">Entity</th>
                      <th className="text-left">Transition</th>
                      <th className="text-left">Actor ID</th>
                      <th className="text-left">Reason / Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageHistory.map((item) => (
                      <tr key={item.id} className="border-b border-border/40 hover:bg-secondary/20 text-xs">
                        <td className="whitespace-nowrap font-mono text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </td>
                        <td>
                          <span className="font-semibold block">{item.entityType}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {item.entityId.slice(0, 10)}…
                          </span>
                        </td>
                        <td>
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-[11px] font-mono">
                              {item.fromStatus || "initial"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[11px] font-mono">
                              {item.toStatus}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-muted-foreground">
                          {item.actorId ? item.actorId.slice(0, 12) + "…" : "system"}
                        </td>
                        <td className="text-muted-foreground">{item.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {stageTotal > stagePageSize && (
              <div className="p-3 border-t border-border flex items-center justify-between text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={stagePage === 0}
                  onClick={() => setStagePage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {stagePage + 1} of {Math.ceil(stageTotal / stagePageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(stagePage + 1) * stagePageSize >= stageTotal}
                  onClick={() => setStagePage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
