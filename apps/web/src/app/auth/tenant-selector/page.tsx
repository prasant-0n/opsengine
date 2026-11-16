"use client";

import { useState } from "react";
import { BrandLockup, BrandMark } from "@/components/layout/brand";

export default function TenantSelectorPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    isActive: boolean;
  }>>([]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/tenant-selector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      setWorkspaces(data.workspaces);
    } catch {
      setError("Could not resolve organization. Check your domain or email.");
    } finally {
      setLoading(false);
    }
  };

  const selectWorkspace = (ws: { id: string; name: string; domain: string | null; slug: string }) => {
    window.location.href = `/auth/login?tenant=${ws.domain ?? ws.slug}`;
  };

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <BrandLockup env="Workspace Portal" />
        <span className="badge badge-outline">
          <span className="material-symbols-outlined icon-sm">lock</span>
          TLS 1.3 Encrypted
        </span>
      </header>

      <main className="auth-content">
        <div className="form-container">
          <div className="form-header">
            <div className="form-mark">
              <BrandMark size={40} />
            </div>
            <h1 className="form-title">Sign in to your organization</h1>
            <p className="form-subtitle">
              Enter your work email or company domain to access your workspace
              portal.
            </p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="alert alert-error" role="alert">
                <span className="material-symbols-outlined icon-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLookup} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="identifier">
                  Work Email or Workspace Domain
                </label>
                <div className="form-input-group">
                  <span className="material-symbols-outlined form-input-icon-left">
                    apartment
                  </span>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@acme.com or acme.opsengine.enterprise"
                    required
                    disabled={loading}
                    className="input pl-9"
                    autoComplete="email"
                  />
                </div>
                <p className="form-hint">
                  <span className="material-symbols-outlined icon-sm">
                    info
                  </span>
                  We will look up all workspaces linked to your identity.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  "Resolving Workspaces..."
                ) : (
                  <>
                    Find My Workspace
                    <span className="material-symbols-outlined icon-inline">
                      search
                    </span>
                  </>
                )}
              </button>
            </form>

            {workspaces.length > 0 && (
              <div className="space-y-2">
                <label className="form-label">
                  Or choose a recent workspace
                </label>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => selectWorkspace(ws)}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-sm border border-outline-30 bg-input/50 text-on-surface hover:bg-input/80 hover:border-primary-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="workspace-badge text-xs">
                        {ws.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-info">
                        <span className="workspace-name">{ws.name}</span>
                        <span className="workspace-domain">
                          {ws.domain ?? ws.slug}
                        </span>
                      </div>
                      <span className="tenant-dot" />
                    </div>
                    <span className="material-symbols-outlined icon-inline text-outline group-hover:text-primary transition-colors">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs font-mono text-outline">
              Don&apos;t know your organization URL?{" "}
              <span className="text-primary underline underline-offset-4 hover:text-primary-fixed cursor-pointer">
                Request access help
              </span>
            </p>
          </div>

          <div className="break-glass-footer">
            <span className="break-glass-icon text-primary">
              <span className="material-symbols-outlined icon-sm">
                shield_lock
              </span>
            </span>
            <span className="break-glass-text">
              Hardware Key &amp; Break-Glass Protocol Active · OpsEngine Cloud
              Orchestration · Isolated Partition
            </span>
          </div>
        </div>
      </main>

      <footer className="auth-page-footer">
        <span className="auth-footer-text">
          © 2026 OpsEngine — Enterprise Operations Platform
        </span>
        <span className="auth-footer-text">
          Multi-Tenant Isolation Active · SOC 2 Type II · ISO 27001
        </span>
      </footer>
    </div>
  );
}
