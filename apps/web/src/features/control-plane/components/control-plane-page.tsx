"use client";

import { useState, useEffect } from "react";
import { X, Building2, Sliders, ShieldAlert, FileText } from "lucide-react";

export interface WorkspaceItem {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  domain?: string | null;
  isActive: boolean;
  lifecycleStatus: string;
  suspendedReason?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  subscription: {
    id: string;
    planTier: string;
    status: string;
    seatLimit: number;
    storageLimitBytes: number;
    features: string[];
  };
  utilization: {
    activeSeats: number;
    seatLimit: number;
    seatUsagePercent: number;
    storageUsedBytes: number;
    storageLimitBytes: number;
    storageUsagePercent: number;
    activeSessions: number;
  };
}

export interface ControlPlaneMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalSubscribedSeats: number;
}

export function ControlPlanePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [metrics, setMetrics] = useState<ControlPlaneMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWs, setSelectedWs] = useState<WorkspaceItem | null>(null);

  // Modals
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedData, setExportedData] = useState<any | null>(null);

  // Forms
  const [provName, setProvName] = useState("");
  const [provSlug, setProvSlug] = useState("");
  const [provDomain, setProvDomain] = useState("");
  const [provPlan, setProvPlan] = useState<string>("professional");
  const [provAdminEmail, setProvAdminEmail] = useState("");
  const [provAdminPassword, setProvAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Subscription Edit
  const [subTier, setSubTier] = useState<string>("professional");
  const [subSeats, setSubSeats] = useState<number>(25);
  const [subStorageGB, setSubStorageGB] = useState<number>(25);

  // Support Session
  const [supportReason, setSupportReason] = useState("");
  const [issuedSupportToken, setIssuedSupportToken] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/control-plane/workspaces");
      if (!res.ok) throw new Error("Failed to load control plane portfolio");
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      if (data.metrics) setMetrics(data.metrics);
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName.trim() || !provSlug.trim() || !provAdminEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/control-plane/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: provName.trim(),
          slug: provSlug.trim(),
          domain: provDomain.trim() || undefined,
          planTier: provPlan,
          adminEmail: provAdminEmail.trim(),
          adminPassword: provAdminPassword.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Provisioning failed");
      setShowProvisionModal(false);
      setProvName("");
      setProvSlug("");
      setProvDomain("");
      setProvAdminEmail("");
      setProvAdminPassword("");
      await fetchWorkspaces();
    } catch {
      // Handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLifecycle = async (ws: WorkspaceItem) => {
    const isCurrentlyActive = ws.lifecycleStatus === "active";
    const nextStatus = isCurrentlyActive ? "suspended" : "active";
    let reason = "";

    if (isCurrentlyActive) {
      const inputReason = window.prompt(
        `Are you sure you want to suspend "${ws.name}"? This will immediately revoke all active user sessions.\n\nEnter suspension reason:`,
        "Billing delinquent / payment terms expired"
      );
      if (inputReason === null) return;
      reason = inputReason.trim() || "Suspended by operator";
    }

    try {
      const res = await fetch(`/api/control-plane/workspaces/${ws.tenantId}/lifecycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      if (!res.ok) throw new Error("Lifecycle update failed");
      await fetchWorkspaces();
    } catch {
      // Handled silently
    }
  };

  const openSubscriptionModal = (ws: WorkspaceItem) => {
    setSelectedWs(ws);
    setSubTier(ws.subscription.planTier);
    setSubSeats(ws.subscription.seatLimit);
    setSubStorageGB(
      Math.round(ws.subscription.storageLimitBytes / (1024 * 1024 * 1024)) || 10
    );
    setShowSubscriptionModal(true);
  };

  const handleSaveSubscription = async () => {
    if (!selectedWs) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/control-plane/workspaces/${selectedWs.tenantId}/subscription`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planTier: subTier,
            seatLimit: subSeats,
            storageLimitGB: subStorageGB,
          }),
        }
      );
      if (!res.ok) throw new Error("Subscription update failed");
      setShowSubscriptionModal(false);
      await fetchWorkspaces();
    } catch {
      // Handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = async (ws: WorkspaceItem) => {
    setSelectedWs(ws);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/control-plane/workspaces/${ws.tenantId}/export`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      setExportedData(data);
      setShowExportModal(true);
    } catch {
      // Handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupportSession = async () => {
    if (!selectedWs || !supportReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/control-plane/workspaces/${selectedWs.tenantId}/support-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: supportReason.trim() }),
        }
      );
      if (!res.ok) throw new Error("Support session failed");
      const data = await res.json();
      setIssuedSupportToken(data.session.token);
    } catch {
      // Handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              shield_with_house
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Platform Control Plane
            </h1>
            <span className="badge badge-primary text-[10px] font-mono">
              Operator Root
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Multi-tenant SaaS orchestration, lifecycle state machine &amp; entitlements
          </p>
        </div>

        <button
          onClick={() => setShowProvisionModal(true)}
          className="btn btn-primary"
        >
          <span className="material-symbols-outlined icon-inline">add_business</span>
          Provision Tenant
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs font-medium text-muted-foreground block">
            Total Workspaces
          </span>
          <span className="text-2xl font-bold font-mono text-foreground mt-2 block tabular-nums">
            {metrics ? metrics.totalTenants : 0}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            Provisioned SaaS tenants
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-muted-foreground block">
            Active Workspaces
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-500 mt-2 block tabular-nums">
            {metrics ? metrics.activeTenants : 0}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            Operating normally
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-muted-foreground block">
            Suspended Tenants
          </span>
          <span className="text-2xl font-bold font-mono text-destructive mt-2 block tabular-nums">
            {metrics ? metrics.suspendedTenants : 0}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            Sessions terminated
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-muted-foreground block">
            Total Subscribed Seats
          </span>
          <span className="text-2xl font-bold font-mono text-foreground mt-2 block tabular-nums">
            {metrics ? metrics.totalSubscribedSeats : 0}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            Across all plan tiers
          </span>
        </div>
      </div>

      {/* Main Workspaces Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Tenant Portfolio &amp; Quotas
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            Server-side quota enforcement active
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Loading tenant portfolio...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No tenant workspaces found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs font-mono">
              <thead className="bg-secondary/50 text-muted-foreground text-[11px] font-medium border-b border-border">
                <tr>
                  <th className="p-3">Organization / Slug</th>
                  <th className="p-3">Plan Tier</th>
                  <th className="p-3">Seat Quota</th>
                  <th className="p-3">Storage Quota</th>
                  <th className="p-3">State</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workspaces.map((ws) => {
                  const isSuspended = ws.lifecycleStatus === "suspended";
                  return (
                    <tr key={ws.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-foreground text-sm font-sans">
                          {ws.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {ws.slug} {ws.domain ? `· ${ws.domain}` : ""}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: {ws.tenantId.slice(0, 13)}...
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="badge badge-outline capitalize text-[11px]">
                          {ws.subscription.planTier}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Status: {ws.subscription.status}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1 tabular-nums">
                          <span>{ws.utilization.activeSeats} / {ws.subscription.seatLimit} seats</span>
                          <span>{ws.utilization.seatUsagePercent}%</span>
                        </div>
                        <div className="w-28 bg-secondary rounded-full h-1.5 overflow-hidden border border-border">
                          <div
                            className={`h-full ${
                              ws.utilization.seatUsagePercent > 90
                                ? "bg-destructive"
                                : ws.utilization.seatUsagePercent > 70
                                ? "bg-amber-500"
                                : "bg-primary"
                            }`}
                            style={{ width: `${ws.utilization.seatUsagePercent}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1 tabular-nums">
                          <span>{formatBytes(ws.utilization.storageUsedBytes)}</span>
                          <span>{ws.utilization.storageUsagePercent}%</span>
                        </div>
                        <div className="w-28 bg-secondary rounded-full h-1.5 overflow-hidden border border-border">
                          <div
                            className={`h-full ${
                              ws.utilization.storageUsagePercent > 90
                                ? "bg-destructive"
                                : "bg-primary"
                            }`}
                            style={{ width: `${ws.utilization.storageUsagePercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block tabular-nums">
                          of {formatBytes(ws.subscription.storageLimitBytes)}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`badge ${
                            isSuspended ? "badge-error" : "badge-tertiary"
                          } capitalize text-[11px]`}
                        >
                          {ws.lifecycleStatus}
                        </span>
                        {ws.suspendedReason && (
                          <div className="text-[10px] text-destructive mt-1 max-w-[140px] truncate" title={ws.suspendedReason}>
                            {ws.suspendedReason}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleLifecycle(ws)}
                          className={`btn btn-outline text-xs py-1 px-2 ${
                            isSuspended ? "text-success hover:bg-success/10" : "text-error hover:bg-error/10"
                          }`}
                          title={isSuspended ? "Reactivate Workspace" : "Suspend Workspace"}
                        >
                          {isSuspended ? "Reactivate" : "Suspend"}
                        </button>

                        <button
                          onClick={() => openSubscriptionModal(ws)}
                          className="btn btn-outline text-xs py-1 px-2"
                          title="Edit Plan & Quotas"
                        >
                          Plan
                        </button>

                        <button
                          onClick={() => handleExportData(ws)}
                          className="btn btn-outline text-xs py-1 px-2"
                          title="Export Tenant Data Archive"
                        >
                          Export
                        </button>

                        <button
                          onClick={() => {
                            setSelectedWs(ws);
                            setSupportReason("");
                            setIssuedSupportToken(null);
                            setShowSupportModal(true);
                          }}
                          className="btn btn-outline text-xs py-1 px-2 text-warning hover:bg-warning/10"
                          title="Audited Support Break-Glass"
                        >
                          Support
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision Tenant Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="provision-modal-title"
            className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="provision-modal-title" className="font-semibold text-base text-foreground tracking-tight">
                    Provision New SaaS Tenant
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set up isolated workspace boundary, tenant routing slug, and initial root administrator.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProvision} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  placeholder="e.g. Wayne Enterprises"
                  required
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                    Workspace Slug *
                  </label>
                  <input
                    type="text"
                    value={provSlug}
                    onChange={(e) => setProvSlug(e.target.value)}
                    placeholder="wayne.opsengine.enterprise"
                    required
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                    Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={provDomain}
                    onChange={(e) => setProvDomain(e.target.value)}
                    placeholder="wayne.com"
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Plan Tier *
                </label>
                <select
                  value={provPlan}
                  onChange={(e) => setProvPlan(e.target.value)}
                  className="input w-full"
                >
                  <option value="starter">Starter (10 seats, 5 GB storage)</option>
                  <option value="professional">Professional (25 seats, 25 GB storage)</option>
                  <option value="enterprise">Enterprise (100 seats, 100 GB storage, AI assistant)</option>
                </select>
              </div>

              <div className="border-t border-border pt-3.5 space-y-3">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide block">
                  Initial Tenant Administrator
                </span>

                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                    Admin Email *
                  </label>
                  <input
                    type="email"
                    value={provAdminEmail}
                    onChange={(e) => setProvAdminEmail(e.target.value)}
                    placeholder="admin@wayne.com"
                    required
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                    Initial Password (Optional — auto-generated if blank)
                  </label>
                  <input
                    type="password"
                    value={provAdminPassword}
                    onChange={(e) => setProvAdminPassword(e.target.value)}
                    placeholder="Leave empty for secure default"
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs"
                >
                  {submitting ? "Provisioning..." : "Provision Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Edit Modal */}
      {showSubscriptionModal && selectedWs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-modal-title"
            className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="subscription-modal-title" className="font-semibold text-base text-foreground tracking-tight">
                    Manage Plan &amp; Quotas
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {selectedWs.name} · {selectedWs.slug}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubscriptionModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Plan Tier
                </label>
                <select
                  value={subTier}
                  onChange={(e) => setSubTier(e.target.value)}
                  className="input w-full"
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Seat Limit (Active Employees)
                </label>
                <input
                  type="number"
                  min="1"
                  value={subSeats}
                  onChange={(e) => setSubSeats(parseInt(e.target.value, 10))}
                  className="input w-full font-mono tabular-nums text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Storage Quota (GB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={subStorageGB}
                  onChange={(e) => setSubStorageGB(parseInt(e.target.value, 10))}
                  className="input w-full font-mono tabular-nums text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveSubscription}
                  className="btn btn-primary text-xs"
                >
                  {submitting ? "Saving..." : "Update Entitlements"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Break-Glass Modal */}
      {showSupportModal && selectedWs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
            className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="support-modal-title" className="font-semibold text-base text-foreground tracking-tight">
                    Operator Support Break-Glass
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    Audited emergency session for {selectedWs.slug}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="alert alert-warning text-xs font-mono">
                Support break-glass access is time-limited (1 hour) and permanently recorded in the immutable audit trail.
              </div>

              {issuedSupportToken ? (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-foreground/80 block">
                    Issued Break-Glass Token (Expires in 60 mins):
                  </span>
                  <div className="p-3 bg-secondary rounded-lg border border-border font-mono text-xs break-all text-primary select-all">
                    {issuedSupportToken}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                    Authorized Business Justification / Ticket # *
                  </label>
                  <textarea
                    rows={3}
                    value={supportReason}
                    onChange={(e) => setSupportReason(e.target.value)}
                    placeholder="e.g. Critical support escalation ticket SUPP-4042"
                    required
                    className="input w-full"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Close
                </button>
                {!issuedSupportToken && (
                  <button
                    type="button"
                    disabled={submitting || !supportReason.trim()}
                    onClick={handleCreateSupportSession}
                    className="btn btn-primary text-xs"
                  >
                    {submitting ? "Issuing..." : "Generate Session"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Archive Modal */}
      {showExportModal && exportedData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="export-modal-title" className="font-semibold text-base text-foreground tracking-tight">
                    Tenant Data Export Archive
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    Export ID: {exportedData.exportId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground block">Total Records:</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {exportedData.recordCount} items
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Expires In:</span>
                  <span className="text-foreground">7 Days</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block mb-1">
                  JSON Archive Preview:
                </span>
                <pre className="p-3 bg-secondary/50 rounded-lg border border-border max-h-60 overflow-y-auto text-[11px] text-foreground font-mono">
                  {JSON.stringify(exportedData.archive, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-3.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
