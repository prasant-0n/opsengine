"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Inbox,
  Sparkles,
} from "lucide-react";

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();

    if (typeof window === "undefined" || !("EventSource" in window)) {
      const interval = setInterval(load, 30_000);
      return () => clearInterval(interval);
    }

    // Real-Time Server-Sent Events (SSE) Push Subscription (PRD Module 15 & §11)
    const es = new EventSource("/api/notifications/stream");

    es.addEventListener("notification", (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data);
        setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
        setUnreadCount((prev) => prev + 1);
      } catch {}
    });

    es.addEventListener("badge_update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [load]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    await load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await load();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative btn btn-secondary p-2 rounded-md hover:border-primary/50 transition-all duration-200"
        onClick={() => setOpen((s) => !s)}
        title="Notifications"
        aria-label="View notifications"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground font-mono tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] w-80 sm:w-96 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-foreground">Notifications</span>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-primary/20 text-primary border border-primary/30">
                  {unreadCount} unread
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-muted-foreground bg-secondary">
                  all caught up
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                onClick={markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto no-scrollbar p-2 space-y-1.5 divide-y divide-border/20">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="p-3 rounded-full bg-secondary/50 text-muted-foreground mb-2">
                  <Inbox className="w-6 h-6 stroke-1" />
                </div>
                <p className="text-sm font-medium text-foreground">No unread notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You are completely up to date with workspace activity.
                </p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className="group relative flex items-start justify-between gap-3 p-3 rounded-lg bg-card/60 hover:bg-secondary/60 border border-border/40 hover:border-border transition-all duration-150"
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <h4 className="text-xs font-semibold text-foreground truncate">{n.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/70 mt-1 block">
                      {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Mark as read"
                    onClick={() => markRead(n.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border/60 bg-secondary/20 flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Real-time active
            </span>
            <Link
              href="/dashboard/notifications"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              onClick={() => setOpen(false)}
            >
              All notifications <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
