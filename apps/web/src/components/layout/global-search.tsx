"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
      >
        <input
          ref={inputRef}
          type="search"
          className="input input-sm shell-search"
          placeholder="Search workspace (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          aria-label="Global search"
        />
      </div>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 999,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "120%",
              width: "420px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
              boxShadow: "0 15px 35px rgba(0,0,0,0.6)",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid #334155", paddingBottom: "0.5rem" }}>
              <strong>Quick Search</strong>
              <span className="muted mono" style={{ fontSize: "0.75rem" }}>ESC to close</span>
            </div>

            <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {loading ? (
                <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>Searching across workspace…</p>
              ) : results.length === 0 ? (
                <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>{query.length < 2 ? "Type at least 2 characters to search..." : "No matching records found."}</p>
              ) : (
                results.map((r, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(r.href)}
                    style={{
                      padding: "0.6rem 0.75rem",
                      background: "#1e293b",
                      borderRadius: "6px",
                      border: "1px solid #334155",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#1e293b")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{r.title}</strong>
                      <span className="badge badge-outline" style={{ fontSize: "0.7rem" }}>{r.category}</span>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>{r.subtitle}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
