"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS } from "./nav-config";
import { NotificationDropdown } from "@/features/notifications";
import { GlobalSearch } from "./global-search";
import { useShell } from "./shell-context";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Laptop, Menu } from "lucide-react";

function breadcrumbFor(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === pathname) return `${group.label} / ${item.label}`;
    }
  }
  return "Dashboard";
}

export function Topbar() {
  const pathname = usePathname();
  const { whoami, mobileOpen, setMobileOpen } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const userInitials = whoami?.userName
    ? whoami.userName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : whoami?.userEmail
    ? whoami.userEmail.slice(0, 2).toUpperCase()
    : whoami
    ? whoami.userId.slice(0, 2).toUpperCase()
    : "…";

  const userDisplayName =
    whoami?.userName || whoami?.userEmail || (whoami ? whoami.userId.slice(0, 8) : "loading");

  function cycleTheme() {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  return (
    <header className="shell-topbar">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary lg:hidden p-2 rounded-md"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="shell-breadcrumb font-label-sm" aria-label="Breadcrumb">
          {breadcrumbFor(pathname)}
        </div>
      </div>

      <div className="shell-topbar-actions">
        <GlobalSearch />

        <button
          type="button"
          className="btn btn-secondary p-2 rounded-md transition-colors"
          onClick={cycleTheme}
          title={`Current theme: ${theme} (Click to toggle)`}
        >
          {theme === "dark" ? (
            <Moon className="w-4 h-4 text-indigo-400" />
          ) : theme === "light" ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Laptop className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        <NotificationDropdown />

        <div className="shell-user">
          <button
            type="button"
            className="shell-user-btn"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="workspace-badge" aria-hidden="true">
              {userInitials}
            </span>
            <span className="shell-user-meta">
              <span className="shell-user-id truncate max-w-[120px]">
                {userDisplayName}
              </span>
              <span className="shell-user-role font-label-sm">
                {whoami?.roles.map((r) => r.key).join(", ") || "—"}
              </span>
            </span>
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">
              expand_more
            </span>
          </button>

          {menuOpen && (
            <div className="shell-menu w-64 min-w-[256px] max-w-[320px] shadow-xl" role="menu">
              <div className="p-3 border-b border-border/60 space-y-1.5 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Workspace
                </div>
                <div className="font-semibold text-xs text-foreground truncate" title={whoami?.tenantName}>
                  {whoami?.tenantName || "Acme Global Enterprise"}
                </div>
                {whoami?.tenantSlug && (
                  <div className="min-w-0">
                    <span
                      className="inline-block max-w-full text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50 truncate"
                      title={whoami.tenantSlug}
                    >
                      {whoami.tenantSlug}
                    </span>
                  </div>
                )}
                {whoami?.userEmail && (
                  <div className="text-[11px] text-muted-foreground truncate font-mono pt-1 border-t border-border/30" title={whoami.userEmail}>
                    {whoami.userEmail}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="shell-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  cycleTheme();
                }}
              >
                Theme: <span className="capitalize font-semibold text-primary">{theme}</span>
              </button>
              <Link
                href="/dashboard/sessions"
                className="shell-menu-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                Sessions
              </Link>
              <button
                type="button"
                className="shell-menu-item text-destructive hover:bg-destructive/10"
                role="menuitem"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
