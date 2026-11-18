"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarCheck, CheckSquare, ListTodo, Clock } from "lucide-react";

export function MobileNavigation() {
  const pathname = usePathname();

  // Hide on public landing or login pages
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/portal/login")) {
    return null;
  }

  const navItems = [
    {
      label: "My Day",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      label: "Attendance",
      href: "/dashboard/attendance",
      icon: CalendarCheck,
      active: pathname === "/dashboard/attendance",
    },
    {
      label: "Approvals",
      href: "/dashboard/approvals",
      icon: CheckSquare,
      active: pathname.startsWith("/dashboard/approvals"),
    },
    {
      label: "Plan",
      href: "/dashboard/daily-plan",
      icon: ListTodo,
      active: pathname.startsWith("/dashboard/daily-plan"),
    },
    {
      label: "DAR",
      href: "/dashboard/time-reporting",
      icon: Clock,
      active: pathname.startsWith("/dashboard/time-reporting"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block md:hidden bg-[#0B0F17]/95 border-t border-slate-800 backdrop-blur-lg px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition ${
                item.active
                  ? "text-blue-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${item.active ? "text-blue-400" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
