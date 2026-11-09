import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma";
import {
  createCalendarEvent,
  getCalendarEvents,
  getCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
  saveMeetingNotes,
  recordEventAttendance,
  getCalendarMetrics,
} from "../features/calendar/lib/calendar-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

describe("Module 15 — Calendar, Meetings, Decisions & Internal Engagement", () => {
  beforeEach(async () => {
    // Clean up test events
    await prisma.calendarEvent.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        title: { startsWith: "[Test]" },
      },
    });
  });

  it("creates a calendar event with organizer and attendee initialization", async () => {
    const start = new Date(Date.now() + 3600000);
    const end = new Date(Date.now() + 7200000);

    const event = await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Architecture Review & Design Session",
      description: "Reviewing Module 15 calendar & meetings domain model.",
      eventType: "review",
      startTime: start,
      endTime: end,
      location: "Virtual Room - Google Meet",
      attendeeUserIds: [USER_A],
    });

    expect(event).toBeDefined();
    expect(event?.tenantId).toBe(TENANT_A);
    expect(event?.title).toBe("[Test] Architecture Review & Design Session");
    expect(event?.eventType).toBe("review");
    expect(event?.status).toBe("scheduled");
    expect(event?.attendees.length).toBe(1);
    expect(event?.attendees[0].userId).toBe(USER_A);
    expect(event?.attendees[0].status).toBe("accepted");

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A,
        eventType: "calendar.event.create",
        resourceId: event!.id,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(USER_A);
    expect(audit?.decision).toBe("allow");
  });

  it("filters calendar events by category and computes operational metrics", async () => {
    const start = new Date(Date.now() + 100000);
    const end = new Date(Date.now() + 200000);

    await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Annual Company Foundation Day",
      eventType: "holiday",
      startTime: start,
      endTime: end,
      allDay: true,
    });

    await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Weekly Engineering Standup",
      eventType: "meeting",
      startTime: start,
      endTime: end,
    });

    const holidays = await getCalendarEvents(TENANT_A, { eventType: "holiday" });
    expect(holidays.some((e) => e.title === "[Test] Annual Company Foundation Day")).toBe(true);
    expect(holidays.every((e) => e.eventType === "holiday")).toBe(true);

    const metrics = await getCalendarMetrics(TENANT_A);
    expect(metrics).toBeDefined();
    expect(typeof metrics.upcomingHolidays).toBe("number");
    expect(metrics.upcomingHolidays).toBeGreaterThanOrEqual(1);
  });

  it("saves meeting agenda, live notes, structured decisions, and action items", async () => {
    const start = new Date(Date.now() + 100000);
    const end = new Date(Date.now() + 200000);

    const event = await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Strategic Planning & Commercial Handover",
      eventType: "meeting",
      startTime: start,
      endTime: end,
    });

    const decisions = [
      {
        id: "dec-1",
        text: "Adopt calendar & meeting orchestration across all enterprise workspaces.",
        recordedBy: "John Admin",
        timestamp: new Date().toISOString(),
      },
    ];

    const actionItems = [
      {
        id: "act-1",
        task: "Complete E2E Playwright verification on calendar views.",
        ownerId: USER_A,
        ownerName: "Admin User",
        dueDate: "2026-11-15",
        status: "open" as const,
      },
    ];

    const note = await saveMeetingNotes(TENANT_A, event!.id, USER_A, {
      agenda: "1. Calendar Architecture 2. Decisions & Action Items",
      notes: "Reviewed system requirements and confirmed zero cross-tenant leakage.",
      decisions,
      actionItems,
    });

    expect(note).toBeDefined();
    expect(note.tenantId).toBe(TENANT_A);
    expect(note.agenda).toContain("Calendar Architecture");
    expect(Array.isArray(note.decisions)).toBe(true);
    expect((note.decisions as any)[0].text).toContain("Adopt calendar");
    expect(Array.isArray(note.actionItems)).toBe(true);
    expect((note.actionItems as any)[0].task).toContain("Complete E2E");

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A,
        eventType: "calendar.meeting_notes.save",
        resourceId: note.id,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(USER_A);
  });

  it("handles event RSVP and strictly enforces engagement capacity limits", async () => {
    const start = new Date(Date.now() + 100000);
    const end = new Date(Date.now() + 200000);

    // Create engagement event with capacity of 1 participant
    const event = await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Advanced Security Workshop",
      eventType: "training",
      startTime: start,
      endTime: end,
      capacity: 1, // max 1 accepted attendee
    });

    // Organizer USER_A is already accepted (count = 1)
    // An additional user USER_B trying to accept must be blocked by capacity
    await expect(
      recordEventAttendance(TENANT_A, event!.id, USER_B, {
        status: "accepted",
        feedback: "Excited for this workshop!",
        rating: 5,
      })
    ).rejects.toThrow("EVENT_AT_CAPACITY");

    // But USER_B can register tentative or declined RSVP
    const tentative = await recordEventAttendance(TENANT_A, event!.id, USER_B, {
      status: "tentative",
    });
    expect(tentative.status).toBe("tentative");
  });

  it("updates and deletes calendar events", async () => {
    const start = new Date(Date.now() + 100000);
    const end = new Date(Date.now() + 200000);

    const event = await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Provisional Sync",
      eventType: "meeting",
      startTime: start,
      endTime: end,
    });

    const updated = await updateCalendarEvent(TENANT_A, event!.id, USER_A, {
      title: "[Test] Confirmed Executive Sync",
      location: "Boardroom A",
      status: "completed",
    });

    expect(updated?.title).toBe("[Test] Confirmed Executive Sync");
    expect(updated?.location).toBe("Boardroom A");
    expect(updated?.status).toBe("completed");

    const deleteRes = await deleteCalendarEvent(TENANT_A, event!.id, USER_A);
    expect(deleteRes.success).toBe(true);

    const check = await getCalendarEventById(TENANT_A, event!.id);
    expect(check).toBeNull();
  });

  it("cross-tenant negative test: Tenant B cannot access, mutate, or record notes for Tenant A events", async () => {
    const start = new Date(Date.now() + 100000);
    const end = new Date(Date.now() + 200000);

    const eventA = await createCalendarEvent(TENANT_A, USER_A, {
      title: "[Test] Confidential Tenant A Board Meeting",
      eventType: "meeting",
      startTime: start,
      endTime: end,
    });

    // 1. Tenant B cannot find Tenant A event
    const bLookup = await getCalendarEventById(TENANT_B, eventA!.id);
    expect(bLookup).toBeNull();

    // 2. Tenant B events query does not include Tenant A events
    const bList = await getCalendarEvents(TENANT_B);
    expect(bList.some((e) => e.id === eventA!.id)).toBe(false);

    // 3. Tenant B cannot update Tenant A event
    await expect(
      updateCalendarEvent(TENANT_B, eventA!.id, USER_B, {
        title: "Malicious update from Tenant B",
      })
    ).rejects.toThrow("EVENT_NOT_FOUND");

    // 4. Tenant B cannot save meeting notes for Tenant A event
    await expect(
      saveMeetingNotes(TENANT_B, eventA!.id, USER_B, {
        agenda: "Hostile takeover",
      })
    ).rejects.toThrow("EVENT_NOT_FOUND");

    // 5. Tenant B cannot RSVP to Tenant A event
    await expect(
      recordEventAttendance(TENANT_B, eventA!.id, USER_B, {
        status: "accepted",
      })
    ).rejects.toThrow("EVENT_NOT_FOUND");

    // 6. Tenant B cannot delete Tenant A event
    await expect(deleteCalendarEvent(TENANT_B, eventA!.id, USER_B)).rejects.toThrow(
      "EVENT_NOT_FOUND"
    );
  });
});
