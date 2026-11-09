"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Command,
  ArrowRight,
  Clock,
  Loader2,
  FileText,
  User,
  CheckSquare,
  Shield,
  Briefcase,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORY_ICONS: Record<string, any> = {
  employee: User,
  project: Briefcase,
  ticket: CheckSquare,
  approval: Shield,
  proposal: FileText,
  default: Search,
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          const next = !o;
          if (next) setTimeout(() => inputRef.current?.focus(), 50);
          return next;
        });
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Handle arrow navigation in results
  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex].href);
    }
  };

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setSelectedIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Bar */}
      <div
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="group relative flex items-center cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 absolute left-3 text-muted-foreground group-hover:text-primary transition-colors pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          className="input input-sm pl-8 pr-16 w-52 md:w-64 rounded-lg bg-card/80 border-border/80 hover:border-primary/40 focus:border-primary transition-all duration-150 placeholder:text-muted-foreground/80 cursor-pointer"
          placeholder="Search workspace…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDownList}
          aria-label="Global search"
        />
        <div className="absolute right-2 flex items-center gap-0.5 pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-secondary/80 border border-border/60 rounded">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </div>
      </div>

      {/* Popover Command Palette Dialog */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            aria-hidden="true"
          />

          <div
            className="absolute right-0 top-[calc(100%+0.5rem)] w-80 sm:w-[460px] rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Search Header Bar */}
            <div className="flex items-center px-3.5 py-2.5 border-b border-border/60 bg-secondary/30">
              <Search className="w-4 h-4 text-muted-foreground mr-2.5 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
                placeholder="Type to search employees, tickets, approvals..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDownList}
              />
              {loading ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin ml-2 flex-shrink-0" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto no-scrollbar p-2">
              {query.length < 2 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Type at least 2 characters to search across all tenant resources.
                  </p>
                  <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
                    <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-secondary text-muted-foreground">
                      Employees
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-secondary text-muted-foreground">
                      Projects
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-secondary text-muted-foreground">
                      Invoices
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-secondary text-muted-foreground">
                      Approvals
                    </span>
                  </div>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-medium text-foreground">No matches found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No authorized records match &ldquo;<span className="text-primary font-mono">{query}</span>&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((r, idx) => {
                    const IconComp = CATEGORY_ICONS[r.category?.toLowerCase()] || CATEGORY_ICONS.default;
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelect(r.href)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? "bg-primary/15 border border-primary/30 text-foreground"
                            : "bg-card/40 hover:bg-secondary/60 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-md ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-foreground truncate">{r.title}</h4>
                            <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px] capitalize font-mono py-0 px-1.5">
                            {r.category}
                          </Badge>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition-transform ${
                              isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/40"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-border/60 bg-secondary/20 text-[11px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 bg-secondary rounded border border-border/60 text-[10px]">↑</kbd>
                <kbd className="px-1 py-0.5 bg-secondary rounded border border-border/60 text-[10px]">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 bg-secondary rounded border border-border/60 text-[10px]">↵</kbd>
                to select
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 bg-secondary rounded border border-border/60 text-[10px]">esc</kbd>
                to close
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
