"use client";

import Link from "next/link";
import * as React from "react";
import { BrandLockup } from "@/components/layout/brand";
import { SidebarNav } from "./sidebar-nav";
import { ShellProvider, useShell } from "./shell-context";
import { Topbar } from "./topbar";
import { AssistantProvider, FloatingAssistant } from "@/features/assistant";

function ShellLoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-body">
      <aside className="shell-sidebar no-scrollbar">
        <BrandLockup env="workspace" />
        <div className="skeleton-block pulse" />
        <div className="skeleton-block pulse short" />
      </aside>
      <div className="shell-column">
        <div className="shell-topbar">
          <div className="skeleton-line pulse" />
        </div>
        <main className="shell-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="shell-body">
      <aside className="shell-sidebar no-scrollbar">
        <BrandLockup env="workspace" />
      </aside>
      <div className="shell-column">
        <div className="shell-topbar">
          <span className="shell-breadcrumb font-label-sm">Error</span>
        </div>
        <main className="shell-main" id="main-content">
          <div className="state-panel state-panel-error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <p>{message}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { loading, error, retry, mobileOpen, setMobileOpen } = useShell();

  // Close sidebar on Esc key for mobile/tablet
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  if (error) return <ShellError message={error} onRetry={retry} />;
  if (loading) return <ShellLoadingShell>{children}</ShellLoadingShell>;

  return (
    <div className="shell-body">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* Backdrop for mobile & tablet screens */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar with no-scrollbar and responsive drawer */}
      <aside
        className={`shell-sidebar no-scrollbar ${
          mobileOpen ? "mobile-open" : ""
        } z-50`}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between pr-2">
          <Link
            href="/dashboard"
            className="shell-brand-link flex-1"
            aria-label="OpsEngine home"
            onClick={() => setMobileOpen(false)}
          >
            <BrandLockup env="workspace" />
          </Link>
          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-md"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        <div onClick={() => setMobileOpen(false)}>
          <SidebarNav />
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row font-label-sm">Tenant</div>
          <TenantLabel />
        </div>
      </aside>

      <div className="shell-column">
        <Topbar />
        <main className="shell-main" id="main-content">
          {children}
        </main>
        <footer className="break-glass-footer shell-footer">
          <span className="break-glass-icon" aria-hidden="true">
            <span className="material-symbols-outlined icon-sm">shield_lock</span>
          </span>
          <span className="break-glass-text">
            OpsEngine — authorization is enforced server-side on every request.
            Navigation reflects your permissions; it never grants access.
          </span>
        </footer>
      </div>
    </div>
  );
}

function TenantLabel() {
  const { whoami } = useShell();
  return <div className="sidebar-footer-tenant mono">{whoami?.tenantId ?? "—"}</div>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <AssistantProvider>
        <ShellInner>{children}</ShellInner>
        <FloatingAssistant />
      </AssistantProvider>
    </ShellProvider>
  );
}
