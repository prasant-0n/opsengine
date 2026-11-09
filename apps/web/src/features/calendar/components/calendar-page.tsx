"use client";

import { useState, useEffect } from "react";

export interface CalendarEventItem {
  id: string;
  tenantId: string;
  title: string;
  description?: string | null;
  eventType: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string | null;
  status: string;
  organizerId: string;
  capacity?: number | null;
  attendees: Array<{
    id: string;
    userId: string;
    status: string;
    feedback?: string | null;
    rating?: number | null;
  }>;
  meetingNote?: {
    id: string;
    agenda?: string | null;
    notes?: string | null;
    decisions?: Array<{ id: string; text: string; recordedBy: string; timestamp: string }> | null;
    actionItems?: Array<{ id: string; task: string; ownerName: string; dueDate: string; status: "open" | "done" }> | null;
  } | null;
}

export interface CalendarMetrics {
  todayMeetings: number;
  upcomingHolidays: number;
  engagementEvents: number;
  pendingActionItems: number;
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [metrics, setMetrics] = useState<CalendarMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Form states for creating event
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<string>("meeting");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form states for meeting notes
  const [notesAgenda, setNotesAgenda] = useState("");
  const [notesBody, setNotesBody] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newActionTask, setNewActionTask] = useState("");
  const [newActionOwner, setNewActionOwner] = useState("");
  const [newActionDue, setNewActionDue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ metrics: "true" });
      if (filterType !== "all") {
        params.set("eventType", filterType);
      }
      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load calendar events");
      const data = await res.json();
      setEvents(data.events || []);
      if (data.metrics) setMetrics(data.metrics);
      if (selectedEvent) {
        const refreshed = (data.events || []).find((e: CalendarEventItem) => e.id === selectedEvent.id);
        if (refreshed) setSelectedEvent(refreshed);
      }
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filterType]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStart || !newEnd) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          eventType: newType,
          startTime: new Date(newStart).toISOString(),
          endTime: new Date(newEnd).toISOString(),
          location: newLocation.trim() || undefined,
          capacity: newCapacity ? parseInt(newCapacity, 10) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create event");
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewLocation("");
      setNewCapacity("");
      await fetchEvents();
    } catch {
      // Handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleRsvp = async (status: "accepted" | "declined" | "tentative") => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/calendar/events/${selectedEvent.id}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("RSVP failed");
      await fetchEvents();
    } catch {
      // Handled silently
    }
  };

  const openNotesModal = (evt: CalendarEventItem) => {
    setSelectedEvent(evt);
    setNotesAgenda(evt.meetingNote?.agenda || "");
    setNotesBody(evt.meetingNote?.notes || "");
    setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedEvent) return;
    setSavingNotes(true);
    try {
      const existingDecisions = selectedEvent.meetingNote?.decisions || [];
      const updatedDecisions = newDecision.trim()
        ? [
            ...existingDecisions,
            {
              id: `dec-${Date.now()}`,
              text: newDecision.trim(),
              recordedBy: "Organizer",
              timestamp: new Date().toISOString(),
            },
          ]
        : existingDecisions;

      const existingActions = selectedEvent.meetingNote?.actionItems || [];
      const updatedActions = newActionTask.trim()
        ? [
            ...existingActions,
            {
              id: `act-${Date.now()}`,
              task: newActionTask.trim(),
              ownerName: newActionOwner.trim() || "Assignee",
              dueDate: newActionDue || "2026-11-20",
              status: "open" as const,
            },
          ]
        : existingActions;

      const res = await fetch(`/api/calendar/events/${selectedEvent.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agenda: notesAgenda,
          notes: notesBody,
          decisions: updatedDecisions,
          actionItems: updatedActions,
        }),
      });

      if (!res.ok) throw new Error("Failed to save meeting notes");
      setNewDecision("");
      setNewActionTask("");
      setNewActionOwner("");
      setNewActionDue("");
      setShowNotesModal(false);
      await fetchEvents();
    } catch {
      // Handled silently
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleActionItem = async (actId: string) => {
    if (!selectedEvent || !selectedEvent.meetingNote?.actionItems) return;
    const currentActions = selectedEvent.meetingNote.actionItems;
    const updated = currentActions.map((a) =>
      a.id === actId ? { ...a, status: a.status === "open" ? ("done" as const) : ("open" as const) } : a
    );

    try {
      await fetch(`/api/calendar/events/${selectedEvent.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionItems: updated,
        }),
      });
      await fetchEvents();
    } catch {
      // Handled silently
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case "holiday":
        return "badge-primary";
      case "engagement":
      case "training":
        return "badge-success";
      case "interview":
        return "badge-warning";
      case "client_meeting":
        return "badge-neutral";
      default:
        return "badge-outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              calendar_month
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">
              Calendar &amp; Meeting Operations
            </h1>
          </div>
          <p className="text-xs font-mono text-outline mt-1">
            PRD Module 15 · Coordinated schedules, decision tracking &amp; internal engagement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <span className="material-symbols-outlined icon-inline">add_circle</span>
            New Event
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-outline uppercase tracking-wider">
              Today&apos;s Meetings
            </span>
            <span className="material-symbols-outlined text-primary text-xl">
              groups
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {metrics ? metrics.todayMeetings : 0}
            </span>
            <span className="text-[10px] font-mono text-outline block mt-0.5">
              Scheduled for today
            </span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-outline uppercase tracking-wider">
              Upcoming Holidays
            </span>
            <span className="material-symbols-outlined text-secondary text-xl">
              celebration
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {metrics ? metrics.upcomingHolidays : 0}
            </span>
            <span className="text-[10px] font-mono text-outline block mt-0.5">
              Organization holidays
            </span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-outline uppercase tracking-wider">
              Engagement &amp; Fun
            </span>
            <span className="material-symbols-outlined text-success text-xl">
              sports_esports
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {metrics ? metrics.engagementEvents : 0}
            </span>
            <span className="text-[10px] font-mono text-outline block mt-0.5">
              Socials &amp; workshops
            </span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-outline uppercase tracking-wider">
              Open Action Items
            </span>
            <span className="material-symbols-outlined text-warning text-xl">
              checklist
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {metrics ? metrics.pendingActionItems : 0}
            </span>
            <span className="text-[10px] font-mono text-outline block mt-0.5">
              Across all meeting notes
            </span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All Events" },
          { key: "meeting", label: "Meetings" },
          { key: "client_meeting", label: "Client Syncs" },
          { key: "review", label: "Reviews" },
          { key: "holiday", label: "Holidays" },
          { key: "engagement", label: "Fun & Social" },
          { key: "training", label: "Training" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              filterType === tab.key
                ? "bg-primary text-on-primary font-semibold"
                : "bg-surface hover:bg-card text-outline border border-outline-20"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main split grid: Events list & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events listing */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="card p-8 text-center text-outline font-mono text-xs">
              Loading calendar schedules...
            </div>
          ) : events.length === 0 ? (
            <div className="card p-8 text-center text-outline font-mono text-xs">
              No calendar events found for this filter. Click &quot;New Event&quot; to schedule.
            </div>
          ) : (
            events.map((evt) => {
              const isSelected = selectedEvent?.id === evt.id;
              const startDate = new Date(evt.startTime);
              const endDate = new Date(evt.endTime);

              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`card p-4 transition-all cursor-pointer hover:border-primary/50 ${
                    isSelected ? "border-primary ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${getEventBadgeClass(evt.eventType)}`}>
                          {evt.eventType.replace("_", " ")}
                        </span>
                        <h3 className="font-semibold text-sm text-on-surface">
                          {evt.title}
                        </h3>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-outline line-clamp-1">
                          {evt.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs font-mono text-outline pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined icon-inline text-sm">
                            schedule
                          </span>
                          {startDate.toLocaleDateString()} · {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined icon-inline text-sm">
                              location_on
                            </span>
                            {evt.location}
                          </span>
                        )}
                        {evt.capacity && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined icon-inline text-sm">
                              group
                            </span>
                            Capacity: {evt.capacity}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {evt.meetingNote && (
                        <span
                          className="badge badge-outline text-[10px]"
                          title="Meeting notes & decisions recorded"
                        >
                          <span className="material-symbols-outlined icon-inline text-xs">
                            description
                          </span>
                          Minutes
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openNotesModal(evt);
                        }}
                        className="btn btn-outline text-xs py-1 px-2.5"
                      >
                        Notes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Event Inspector */}
        <div className="lg:col-span-1">
          {selectedEvent ? (
            <div className="card p-5 space-y-5 sticky top-6">
              <div className="border-b border-outline-20 pb-3">
                <div className="flex items-center justify-between">
                  <span className={`badge ${getEventBadgeClass(selectedEvent.eventType)}`}>
                    {selectedEvent.eventType.replace("_", " ")}
                  </span>
                  <span className="text-xs font-mono text-outline uppercase">
                    {selectedEvent.status}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-on-surface mt-2">
                  {selectedEvent.title}
                </h2>
                {selectedEvent.description && (
                  <p className="text-xs text-outline mt-1 font-mono">
                    {selectedEvent.description}
                  </p>
                )}
              </div>

              {/* Time and location */}
              <div className="space-y-2 text-xs font-mono text-outline">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined icon-inline text-primary">
                    schedule
                  </span>
                  <span>
                    {new Date(selectedEvent.startTime).toLocaleString()}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined icon-inline text-primary">
                      pin_drop
                    </span>
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>

              {/* RSVP controls */}
              <div className="border-t border-outline-20 pt-4">
                <h4 className="text-xs font-mono uppercase text-outline mb-2">
                  Your Attendance (RSVP)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRsvp("accepted")}
                    className="btn btn-outline text-xs py-1.5 text-success hover:bg-success/10"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRsvp("tentative")}
                    className="btn btn-outline text-xs py-1.5 text-warning hover:bg-warning/10"
                  >
                    Tentative
                  </button>
                  <button
                    onClick={() => handleRsvp("declined")}
                    className="btn btn-outline text-xs py-1.5 text-error hover:bg-error/10"
                  >
                    Decline
                  </button>
                </div>
              </div>

              {/* Attendees list */}
              <div className="border-t border-outline-20 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-mono uppercase text-outline">
                    Attendees ({selectedEvent.attendees.length}
                    {selectedEvent.capacity ? ` / ${selectedEvent.capacity}` : ""})
                  </h4>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedEvent.attendees.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between text-xs font-mono bg-surface p-2 rounded border border-outline-20"
                    >
                      <span className="truncate max-w-[120px]">
                        User {att.userId.slice(0, 8)}...
                      </span>
                      <span className="badge badge-outline text-[10px]">
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meeting decisions & Action items snapshot */}
              <div className="border-t border-outline-20 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase text-outline">
                    Minutes &amp; Action Items
                  </h4>
                  <button
                    onClick={() => openNotesModal(selectedEvent)}
                    className="text-xs text-primary font-mono underline hover:text-primary-fixed"
                  >
                    Edit
                  </button>
                </div>

                {selectedEvent.meetingNote?.decisions && selectedEvent.meetingNote.decisions.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-outline block">
                      Decisions:
                    </span>
                    {selectedEvent.meetingNote.decisions.map((dec) => (
                      <div
                        key={dec.id}
                        className="text-xs p-2 rounded bg-surface border border-outline-20 font-mono"
                      >
                        <p className="text-on-surface">✓ {dec.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedEvent.meetingNote?.actionItems && selectedEvent.meetingNote.actionItems.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-outline block">
                      Action Items:
                    </span>
                    {selectedEvent.meetingNote.actionItems.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => toggleActionItem(act.id)}
                        className={`text-xs p-2 rounded border font-mono cursor-pointer flex items-center justify-between ${
                          act.status === "done"
                            ? "bg-surface/50 border-outline-20 line-through text-outline"
                            : "bg-surface border-outline-20 text-on-surface"
                        }`}
                      >
                        <span className="truncate">{act.task}</span>
                        <span className="badge badge-outline text-[10px] ml-2 shrink-0">
                          {act.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-outline font-mono">
                    No decisions or action items recorded yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-outline font-mono text-xs">
              Select an event to inspect attendees, record RSVP, or review meeting decisions.
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <h3 className="font-semibold text-base text-on-surface">
                Create Calendar Event
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Sprint Architecture Sync"
                  required
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Event Category *
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="input w-full"
                  >
                    <option value="meeting">Team Meeting</option>
                    <option value="client_meeting">Client Meeting</option>
                    <option value="review">Delivery / HR Review</option>
                    <option value="training">Training Session</option>
                    <option value="holiday">Company Holiday</option>
                    <option value="engagement">Fun &amp; Engagement</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    placeholder="e.g. 20"
                    min="1"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-outline block mb-1">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    required
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Location / Meeting Link
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Conference Room 4B or https://meet.google.com/..."
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Description / Objectives
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Key context or prerequisites for attendees..."
                  className="input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? "Saving..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Minutes & Decisions Modal */}
      {showNotesModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-20 pb-3">
              <div>
                <h3 className="font-semibold text-base text-on-surface">
                  Meeting Minutes &amp; Decisions
                </h3>
                <p className="text-xs font-mono text-outline">
                  {selectedEvent.title}
                </p>
              </div>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Meeting Agenda
                </label>
                <textarea
                  value={notesAgenda}
                  onChange={(e) => setNotesAgenda(e.target.value)}
                  rows={2}
                  placeholder="Key topics discussed..."
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-outline block mb-1">
                  Summary Notes &amp; Discussion
                </label>
                <textarea
                  value={notesBody}
                  onChange={(e) => setNotesBody(e.target.value)}
                  rows={4}
                  placeholder="Minutes of the meeting..."
                  className="input w-full"
                />
              </div>

              <div className="border-t border-outline-20 pt-3">
                <label className="text-xs font-mono text-outline block mb-1">
                  Log a Key Decision
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    placeholder="e.g. Approved production deployment on Friday"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="border-t border-outline-20 pt-3 space-y-2">
                <label className="text-xs font-mono text-outline block">
                  Assign New Action Item
                </label>
                <input
                  type="text"
                  value={newActionTask}
                  onChange={(e) => setNewActionTask(e.target.value)}
                  placeholder="Action item task description..."
                  className="input w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newActionOwner}
                    onChange={(e) => setNewActionOwner(e.target.value)}
                    placeholder="Owner name"
                    className="input w-full"
                  />
                  <input
                    type="date"
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-20">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="btn btn-primary"
                >
                  {savingNotes ? "Saving..." : "Save Minutes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
