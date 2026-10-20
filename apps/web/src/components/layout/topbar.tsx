"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS } from "./nav-config";
import { NotificationDropdown } from "@/features/notifications";
import { GlobalSearch } from "./global-search";
import { useShell } from "./shell-context";

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
  const { whoami } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  return (
    <header className="shell-topbar">
      <div className="shell-breadcrumb font-label-sm" aria-label="Breadcrumb">
        {breadcrumbFor(pathname)}
      </div>

      <div className="shell-topbar-actions">
        <GlobalSearch />
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
              {whoami ? whoami.userId.slice(0, 2).toUpperCase() : "…"}
            </span>
            <span className="shell-user-meta">
              <span className="shell-user-id mono">
                {whoami ? whoami.userId.slice(0, 8) : "loading"}
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
            <div className="shell-menu" role="menu">
              <Link
                href="/dashboard"
                className="shell-menu-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                My Day
              </Link>
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
                className="shell-menu-item"
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
