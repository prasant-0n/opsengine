"use client";

import React, { useState, useEffect } from "react";
import {
  Webhook,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  Key,
  ExternalLink,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  rateLimitPerMinute: number;
  description?: string;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventName: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "DEAD_LETTER";
  attemptCount: number;
  maxAttempts: number;
  responseStatus: number | null;
  executionLatencyMs: number | null;
  errorDetails: string | null;
  createdAt: string;
}

interface WebhooksManagementProps {
  tenantId: string;
}

export function WebhooksManagement({ tenantId }: WebhooksManagementProps) {
  const [subTab, setSubTab] = useState<"endpoints" | "deliveries" | "dlq">("endpoints");
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [dlq, setDlq] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState("*");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchEndpoints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks?tenantId=${tenantId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await res.json();
      if (data.success) {
        setEndpoints(data.endpoints || []);
      }
    } catch {
      setError("Failed to load webhook endpoints");
    } finally {
      setLoading(false);
    }
  };

  const fetchDlq = async () => {
    try {
      const res = await fetch(`/api/webhooks/dlq?tenantId=${tenantId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await res.json();
      if (data.success) {
        setDlq(data.dlq || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchEndpoints();
      fetchDlq();
    }
  }, [tenantId]);

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          name: newName,
          url: newUrl,
          eventTypes: newEvents.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Webhook '${newName}' registered successfully with HMAC secret.`);
        setShowCreateModal(false);
        setNewName("");
        setNewUrl("");
        setNewEvents("*");
        fetchEndpoints();
      } else {
        setError(data.details || data.error || "Failed to create webhook");
      }
    } catch {
      setError("Network error registering webhook");
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook subscription?")) return;
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Webhook endpoint deleted.");
        fetchEndpoints();
      }
    } catch {
      setError("Failed to delete webhook");
    }
  };

  const handleTestPing = async (id: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ webhookId: id }),
      });
      const data = await res.json();
      if (data.success) {
        const del = data.delivery;
        setSuccessMsg(`Test ping sent! Status: ${del.status} (${del.responseStatus || "N/A"}), Latency: ${del.executionLatencyMs || 0}ms`);
      } else {
        setError(data.details || data.error || "Ping failed");
      }
    } catch {
      setError("Failed to dispatch test ping");
    }
  };

  const handleReplayDlq = async (deliveryId?: string) => {
    try {
      if (deliveryId) {
        const res = await fetch(`/api/webhooks/deliveries/${deliveryId}/replay`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({ autoDispatch: true }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg("Delivery replayed successfully.");
          fetchDlq();
        }
      } else {
        const res = await fetch("/api/webhooks/dlq", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({ autoDispatch: true }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Replayed ${data.replayedCount} DLQ items.`);
          fetchDlq();
        }
      }
    } catch {
      setError("Failed to replay webhook delivery");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/40 p-4 rounded-xl border border-border">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground text-lg">Outbound Webhooks & DLQ Engine</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Publish real-time events to external integrations with HMAC-SHA256 signatures, exponential retries, and dead-letter protection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchEndpoints();
              fetchDlq();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Webhook</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-border text-sm">
        <button
          onClick={() => setSubTab("endpoints")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px transition ${
            subTab === "endpoints"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Endpoints ({endpoints.length})
        </button>
        <button
          onClick={() => setSubTab("dlq")}
          className={`flex items-center gap-1.5 px-4 py-2 font-medium border-b-2 -mb-px transition ${
            subTab === "dlq"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>Dead Letter Queue</span>
          {dlq.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
              {dlq.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Endpoints */}
      {subTab === "endpoints" && (
        <div className="space-y-4">
          {endpoints.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Webhook className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No webhook endpoints registered</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your first destination endpoint to receive domain events.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="p-4 border border-border rounded-xl bg-card hover:border-primary/40 transition flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{ep.name}</span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                          ep.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ep.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>{ep.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ep.eventTypes.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => copyToClipboard(ep.secret, ep.id)}
                      title="Copy HMAC Secret"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground transition"
                    >
                      {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Key className="w-3.5 h-3.5" />}
                      <span>{copiedId === ep.id ? "Copied" : "Secret"}</span>
                    </button>
                    <button
                      onClick={() => handleTestPing(ep.id)}
                      title="Send test ping"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Test Ping</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEndpoint(ep.id)}
                      title="Delete webhook"
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: DLQ */}
      {subTab === "dlq" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Failed webhook events after exhausting 5 exponential retries. You can manually inspect and replay them.
            </p>
            {dlq.length > 0 && (
              <button
                onClick={() => handleReplayDlq()}
                className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                Replay All ({dlq.length})
              </button>
            )}
          </div>

          {dlq.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">Dead Letter Queue is empty</p>
              <p className="text-xs text-muted-foreground mt-1">All outbound webhook deliveries succeeded.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dlq.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 border border-rose-500/20 bg-rose-500/5 rounded-xl flex flex-col md:flex-row justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono text-foreground">{item.eventName}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                        DEAD LETTER
                      </span>
                    </div>
                    <div className="text-muted-foreground font-mono">Event ID: {item.eventId}</div>
                    {item.errorDetails && (
                      <div className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                        {item.errorDetails}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => handleReplayDlq(item.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-background border border-border hover:bg-muted text-foreground rounded-lg transition"
                    >
                      Replay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-base">Register Webhook Endpoint</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEndpoint} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">Endpoint Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Zapier Sync"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Destination URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Must be a public HTTPS endpoint. Localhost and private subnets are blocked by Anti-SSRF guardrails.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Subscribed Events (comma-separated)</label>
                <input
                  type="text"
                  placeholder="*, crm.*, work.ticket.*"
                  value={newEvents}
                  onChange={(e) => setNewEvents(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Use <code>*</code> for all events or patterns like <code>crm.*</code> or <code>recruitment.*</code>.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs border border-border rounded-lg text-foreground hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition shadow-sm"
                >
                  Register Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
