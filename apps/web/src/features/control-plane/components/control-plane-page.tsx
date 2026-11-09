"use client";

import { useState, useEffect } from "react";

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              shield_with_house
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">
              Platform Control Plane
            </h1>
            <span className="badge badge-primary text-[10px] font-mono">
              Operator Root
            </span>
          </div>
          <p className="text-xs font-mono text-outline mt-1">
            PRD Module 0A · Multi-tenant SaaS orchestration, lifecycle state machine &amp; entitlements
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
          <span className="text-xs font-mono text-outline uppercase tracking-wider block">
            Total Workspaces
          </span>
          <span className="text-2xl font-bold font-mono text-on-surface mt-2 block">
            {metrics ? metrics.totalTenants : 0}
          </span>
          <span className="text-[10px] font-mono text-outline block mt-0.5">
            Provisioned SaaS tenants
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-mono text-outline uppercase tracking-wider block">
            Active Workspaces
          </span>
          <span className="text-2xl font-bold font-mono text-success mt-2 block">
            {metrics ? metrics.activeTenants : 0}
          </span>
          <span className="text-[10px] font-mono text-outline block mt-0.5">
            Operating normally
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-mono text-outline uppercase tracking-wider block">
            Suspended Tenants
          </span>
          <span className="text-2xl font-bold font-mono text-error mt-2 block">
            {metrics ? metrics.suspendedTenants : 0}
          </span>
          <span className="text-[10px] font-mono text-outline block mt-0.5">
            Sessions terminated
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-mono text-outline uppercase tracking-wider block">
            Total Subscribed Seats
          </span>
          <span className="text-2xl font-bold font-mono text-on-surface mt-2 block">
            {metrics ? metrics.totalSubscribedSeats : 0}
          </span>
          <span className="text-[10px] font-mono text-outline block mt-0.5">
            Across all plan tiers
          </span>
        </div>
      </div>

      {/* Main Workspaces Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-outline-20 flex items-center justify-between">
          <h2 className="text-sm font-semibold font-mono uppercase text-on-surface">
            Tenant Portfolio &amp; Quotas
          </h2>
          <span className="text-xs font-mono text-outline">
            Server-side quota enforcement active
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-outline">
            Loading tenant portfolio...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-outline">
            No tenant workspaces found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs font-mono">
              <thead className="bg-surface text-outline uppercase text-[10px] border-b border-outline-20">
                <tr>
                  <th className="p-3">Organization / Slug</th>
                  <th className="p-3">Plan Tier</th>
                  <th className="p-3">Seat Quota</th>
                  <th className="p-3">Storage Quota</th>
                  <th className="p-3">State</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-20">
                {workspaces.map((ws) => {
                  const isSuspended = ws.lifecycleStatus === "suspended";
                  return (
                    <tr key={ws.id} className="hover:bg-card/50 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-on-surface text-sm">
                          {ws.name}
                        </div>
                        <div className="text-[11px] text-outline">
                          {ws.slug} {ws.domain ? `· ${ws.domain}` : ""}
                        </div>
                        <div className="text-[10px] text-outline">
                          ID: {ws.tenantId.slice(0, 13)}...
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="badge badge-outline uppercase text-[10px]">
                          {ws.subscription.planTier}
                        </span>
                        <div className="text-[10px] text-outline mt-1">
                          Status: {ws.subscription.status}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>{ws.utilization.activeSeats} / {ws.subscription.seatLimit} seats</span>
                          <span>{ws.utilization.seatUsagePercent}%</span>
                        </div>
                        <div className="w-28 bg-surface rounded-full h-1.5 overflow-hidden border border-outline-20">
                          <div
                            className={`h-full ${
                              ws.utilization.seatUsagePercent > 90
                                ? "bg-error"
                                : ws.utilization.seatUsagePercent > 70
                                ? "bg-warning"
                                : "bg-primary"
                            }`}
                            style={{ width: `${ws.utilization.seatUsagePercent}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>{formatBytes(ws.utilization.storageUsedBytes)}</span>
                          <span>{ws.utilization.storageUsagePercent}%</span>
                        </div>
                        <div className="w-28 bg-surface rounded-full h-1.5 overflow-hidden border border-outline-20">
                          <div
                            className={`h-full ${
                              ws.utilization.storageUsagePercent > 90
                                ? "bg-error"
                                : "bg-primary"
                            }`}
                            style={{ width: `${ws.utilization.storageUsagePercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-outline mt-0.5 block">
                          of {formatBytes(ws.subscription.storageLimitBytes)}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`badge ${
                            isSuspended ? "badge-error" : "badge-success"
                          } uppercase text-[10px]`}
                        >
                          {ws.lifecycleStatus}
                        </span>
                        {ws.suspendedReason && (
                          <div className="text-[10px] text-error mt-1 max-w-[140px] truncate" title={ws.suspendedReason}>
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <h3 className="font-semibold text-base text-on-surface">
                Provision New SaaS Tenant
              </h3>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvision} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-outline block mb-1">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Workspace Slug *
                  </label>
                  <input
                    type="text"
                    value={provSlug}
                    onChange={(e) => setProvSlug(e.target.value)}
                    placeholder="wayne.opsengine.enterprise"
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={provDomain}
                    onChange={(e) => setProvDomain(e.target.value)}
                    placeholder="wayne.com"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-outline block mb-1">
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

              <div className="border-t border-outline-20 pt-3 space-y-3">
                <span className="text-xs font-mono uppercase text-outline block">
                  Initial Tenant Administrator
                </span>

                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Admin Email *
                  </label>
                  <input
                    type="email"
                    value={provAdminEmail}
                    onChange={(e) => setProvAdminEmail(e.target.value)}
                    placeholder="admin@wayne.com"
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Initial Password (Optional — auto-generated if blank)
                  </label>
                  <input
                    type="password"
                    value={provAdminPassword}
                    onChange={(e) => setProvAdminPassword(e.target.value)}
                    placeholder="Leave empty for secure default"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <h3 className="font-semibold text-base text-on-surface">
                Manage Plan &amp; Quotas: {selectedWs.name}
              </h3>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-outline block mb-1">
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
                <label className="text-xs font-mono text-outline block mb-1">
                  Seat Limit (Active Employees)
                </label>
                <input
                  type="number"
                  min="1"
                  value={subSeats}
                  onChange={(e) => setSubSeats(parseInt(e.target.value, 10))}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Storage Quota (GB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={subStorageGB}
                  onChange={(e) => setSubStorageGB(parseInt(e.target.value, 10))}
                  className="input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveSubscription}
                  className="btn btn-primary"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <h3 className="font-semibold text-base text-on-surface">
                Operator Support Break-Glass
              </h3>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="alert alert-warning text-xs font-mono">
                Support break-glass access is time-limited (1 hour) and permanently recorded in the immutable audit trail.
              </div>

              {issuedSupportToken ? (
                <div className="space-y-2">
                  <span className="text-xs font-mono text-outline block">
                    Issued Break-Glass Token (Expires in 60 mins):
                  </span>
                  <div className="p-3 bg-surface rounded border border-outline-20 font-mono text-xs break-all text-primary select-all">
                    {issuedSupportToken}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="btn btn-outline"
                >
                  Close
                </button>
                {!issuedSupportToken && (
                  <button
                    type="button"
                    disabled={submitting || !supportReason.trim()}
                    onClick={handleCreateSupportSession}
                    className="btn btn-primary"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <div>
                <h3 className="font-semibold text-base text-on-surface">
                  Tenant Data Export Archive
                </h3>
                <p className="text-xs font-mono text-outline">
                  Export ID: {exportedData.exportId}
                </p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 bg-surface p-3 rounded border border-outline-20">
                <div>
                  <span className="text-outline block">Total Records:</span>
                  <span className="font-bold text-on-surface">
                    {exportedData.recordCount} items
                  </span>
                </div>
                <div>
                  <span className="text-outline block">Expires In:</span>
                  <span className="text-on-surface">7 Days</span>
                </div>
              </div>

              <div>
                <span className="text-outline block mb-1">
                  JSON Archive Preview:
                </span>
                <pre className="p-3 bg-surface rounded border border-outline-20 max-h-60 overflow-y-auto text-[11px] text-outline">
                  {JSON.stringify(exportedData.archive, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-outline"
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
