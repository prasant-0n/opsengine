"use client";

import React, { useState, useEffect } from "react";
import { X, Send, User, ShieldCheck, Clock, AlertCircle } from "lucide-react";

interface TicketDetailModalProps {
  ticket: any | null;
  onClose: () => void;
  onPostComment: (ticketId: string, body: string) => Promise<any>;
}

export function PortalTicketDetailModal({
  ticket,
  onClose,
  onPostComment,
}: TicketDetailModalProps) {
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<any[]>(ticket?.comments || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket?.id) {
      setLoading(true);
      fetch(`/api/portal/tickets/${ticket.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.comments) {
            setComments(data.data.comments);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [ticket?.id]);

  if (!ticket) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await onPostComment(ticket.id, commentText);
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
      }
      setCommentText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {ticket.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  ticket.status === "open"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : ticket.status === "in_progress"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {ticket.status}
              </span>
              {ticket.slaStatus && (
                <span
                  className={`text-xs font-medium flex items-center gap-1 ${
                    ticket.slaStatus.isBreached ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {ticket.slaStatus.label}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold mt-2">{ticket.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Logged on {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Stream */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 max-h-[480px]">
          {ticket.description && (
            <div className="p-4 rounded-xl bg-muted/40 border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                Initial Request Details
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading comments...</div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No comments posted yet.</p>
          ) : (
            comments.map((c) => {
              const isStaff = c.authorType === "staff";
              return (
                <div
                  key={c.id}
                  className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                    {isStaff ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-semibold text-blue-600">{c.authorName} (Support)</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">{c.authorName}</span>
                        <User className="w-3.5 h-3.5" />
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      isStaff
                        ? "bg-muted text-foreground border rounded-tl-sm"
                        : "bg-blue-600 text-white rounded-tr-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Box */}
        <form onSubmit={handleSend} className="p-4 border-t bg-card flex gap-2 items-center">
          <input
            type="text"
            placeholder="Type your reply here..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? "Sending..." : "Reply"}
          </button>
        </form>
      </div>
    </div>
  );
}
