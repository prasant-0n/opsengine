"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, filterNavGroups, type NavItem } from "./nav-config";
import { useShell } from "./shell-context";

function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const { can } = useShell();
  const locked =
    item.behavior === "lock" && item.permission && !can(item.permission);

  return (
    <li>
      <Link
        href={item.href}
        className={`nav-entry${active ? " nav-entry-active" : ""}${
          locked ? " nav-entry-locked" : ""
        }`}
        aria-current={active ? "page" : undefined}
      >
        <span className="material-symbols-outlined icon-sm" aria-hidden="true">
          {locked ? "lock" : item.icon}
        </span>
        <span className="nav-entry-label">{item.label}</span>
        {item.soon && <span className="nav-badge">soon</span>}
        {locked && <span className="nav-badge">no access</span>}
      </Link>
    </li>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { can } = useShell();
  const groups = filterNavGroups(NAV_GROUPS, can);

  return (
    <nav className="sidebar-nav" aria-label="Primary">
      {groups.map((group) => {
        return (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            <ul className="nav-group-list">
              {group.items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  active={
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href
                  }
                />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
