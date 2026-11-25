"use client";

import * as React from "react";
import { useShell } from "@/components/layout/shell-context";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  isError?: boolean;
  modelUsed?: string;
  feedback?: "helpful" | "unhelpful" | null;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export type ToneMode = "standard" | "executive" | "audit";

interface AssistantContextType {
  messages: ChatMessage[];
  input: string;
  setInput: (val: string) => void;
  loading: boolean;
  error: string | null;
  enabled: boolean | null;
  canUse: boolean;
  send: (customPrompt?: string) => Promise<void>;
  clearConversation: () => void;
  drawerState: "closed" | "open" | "minimized";
  openDrawer: () => void;
  closeDrawer: () => void;
  minimizeDrawer: () => void;
  toggleDrawer: () => void;
  // Thread Management
  threads: ChatThread[];
  currentThreadId: string;
  createNewThread: () => void;
  selectThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  // Tone Mode
  toneMode: ToneMode;
  setToneMode: (mode: ToneMode) => void;
  // Interaction & Feedback
  setMessageFeedback: (messageId: string, feedback: "helpful" | "unhelpful" | null) => void;
  regenerateLastMessage: () => Promise<void>;
}

const AssistantContext = React.createContext<AssistantContextType | null>(null);

function createFreshThread(): ChatThread {
  return {
    id: `t-${Date.now()}`,
    title: "New Conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { can, whoami } = useShell();
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerState, setDrawerState] = React.useState<"closed" | "open" | "minimized">("closed");
  const [toneMode, setToneMode] = React.useState<ToneMode>("standard");

  // Multi-session threads state
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = React.useState<string>("");

  const canUse = can("assistant.use");

  // Storage key scoped to active tenant & user
  const storageKey = React.useMemo(() => {
    return `opsengine_threads_${whoami?.tenantId ?? "default"}_${whoami?.userId ?? "guest"}`;
  }, [whoami?.tenantId, whoami?.userId]);

  // Load threads from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setThreads(parsed);
          setCurrentThreadId(parsed[0].id);
          return;
        }
      }
    } catch {}

    const initial = createFreshThread();
    setThreads([initial]);
    setCurrentThreadId(initial.id);
  }, [storageKey]);

  // Save threads to localStorage whenever they mutate
  React.useEffect(() => {
    if (threads.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(threads));
      } catch {}
    }
  }, [threads, storageKey]);

  // Check backend AI entitlement
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/assistant/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { aiEnabled: false }))
      .then((d) => {
        if (!cancelled) setEnabled(!!d.aiEnabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeThread = React.useMemo(() => {
    return threads.find((t) => t.id === currentThreadId) ?? threads[0] ?? null;
  }, [threads, currentThreadId]);

  const messages = activeThread?.messages ?? [];

  const send = React.useCallback(
    async (customPrompt?: string) => {
      const promptToSend = (customPrompt ?? input).trim();
      if (!promptToSend || loading || !canUse) return;

      if (!customPrompt) {
        setInput("");
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: promptToSend,
        createdAt: new Date().toISOString(),
      };

      const nowIso = new Date().toISOString();

      // Append user message and update thread title if first message
      setThreads((prevThreads) =>
        prevThreads.map((t) => {
          if (t.id === (activeThread?.id ?? currentThreadId)) {
            const isInitial = t.title === "New Conversation" || t.messages.length === 0;
            const newTitle = isInitial
              ? promptToSend.slice(0, 32) + (promptToSend.length > 32 ? "…" : "")
              : t.title;
            return {
              ...t,
              title: newTitle,
              updatedAt: nowIso,
              messages: [...t.messages, userMsg],
            };
          }
          return t;
        })
      );

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptToSend, toneMode }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMessage = data.error ?? `Failed (${res.status})`;
          setError(errMessage);
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            text: `Error: ${errMessage}`,
            createdAt: new Date().toISOString(),
            isError: true,
          };
          setThreads((prev) =>
            prev.map((t) =>
              t.id === (activeThread?.id ?? currentThreadId)
                ? { ...t, messages: [...t.messages, errorMsg] }
                : t
            )
          );
          return;
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.response ?? "No response generated.",
          createdAt: new Date().toISOString(),
          modelUsed: data.model ?? "Gemini 1.5 Flash",
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id === (activeThread?.id ?? currentThreadId)
              ? { ...t, messages: [...t.messages, assistantMsg], updatedAt: new Date().toISOString() }
              : t
          )
        );
      } catch (err: any) {
        const errMessage = err.message ?? "Network error";
        setError(errMessage);
        const netErrorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Network failure: ${errMessage}`,
          createdAt: new Date().toISOString(),
          isError: true,
        };
        setThreads((prev) =>
          prev.map((t) =>
            t.id === (activeThread?.id ?? currentThreadId)
              ? { ...t, messages: [...t.messages, netErrorMsg] }
              : t
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, canUse, activeThread?.id, currentThreadId, toneMode]
  );

  const clearConversation = React.useCallback(() => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, messages: [], updatedAt: new Date().toISOString() } : t))
    );
    setError(null);
  }, [activeThread]);

  const createNewThread = React.useCallback(() => {
    const fresh = createFreshThread();
    setThreads((prev) => [fresh, ...prev]);
    setCurrentThreadId(fresh.id);
    setError(null);
  }, []);

  const selectThread = React.useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setError(null);
  }, []);

  const deleteThread = React.useCallback((threadId: string) => {
    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== threadId);
      if (remaining.length === 0) {
        const fresh = createFreshThread();
        setCurrentThreadId(fresh.id);
        return [fresh];
      }
      return remaining;
    });
  }, []);

  const setMessageFeedback = React.useCallback((messageId: string, feedback: "helpful" | "unhelpful" | null) => {
    setThreads((prev) =>
      prev.map((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
      }))
    );
  }, []);

  const regenerateLastMessage = React.useCallback(async () => {
    if (!activeThread || activeThread.messages.length === 0 || loading) return;
    const lastUser = [...activeThread.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    // Remove the trailing assistant message if one exists
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThread.id) {
          const msgs = [...t.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            msgs.pop();
          }
          return { ...t, messages: msgs };
        }
        return t;
      })
    );

    await send(lastUser.text);
  }, [activeThread, loading, send]);

  const openDrawer = React.useCallback(() => setDrawerState("open"), []);
  const closeDrawer = React.useCallback(() => setDrawerState("closed"), []);
  const minimizeDrawer = React.useCallback(() => setDrawerState("minimized"), []);
  const toggleDrawer = React.useCallback(() => {
    setDrawerState((prev) => (prev === "open" ? "minimized" : "open"));
  }, []);

  const value = React.useMemo(
    () => ({
      messages,
      input,
      setInput,
      loading,
      error,
      enabled,
      canUse,
      send,
      clearConversation,
      drawerState,
      openDrawer,
      closeDrawer,
      minimizeDrawer,
      toggleDrawer,
      threads,
      currentThreadId: activeThread?.id ?? currentThreadId,
      createNewThread,
      selectThread,
      deleteThread,
      toneMode,
      setToneMode,
      setMessageFeedback,
      regenerateLastMessage,
    }),
    [
      messages,
      input,
      loading,
      error,
      enabled,
      canUse,
      send,
      clearConversation,
      drawerState,
      openDrawer,
      closeDrawer,
      minimizeDrawer,
      toggleDrawer,
      threads,
      activeThread?.id,
      currentThreadId,
      createNewThread,
      selectThread,
      deleteThread,
      toneMode,
      setMessageFeedback,
      regenerateLastMessage,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = React.useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within an AssistantProvider");
  }
  return context;
}
