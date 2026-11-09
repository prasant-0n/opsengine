import { prisma } from "@/lib/prisma";
import { writeAuditAsync } from "@/lib/permissions/audit";

export type EventType =
  | "meeting"
  | "client_meeting"
  | "interview"
  | "review"
  | "training"
  | "holiday"
  | "engagement";

export interface DecisionItem {
  id: string;
  text: string;
  recordedBy: string;
  timestamp: string;
}

export interface ActionItem {
  id: string;
  task: string;
  ownerId: string;
  ownerName: string;
  dueDate: string;
  status: "open" | "done";
}

export interface CreateEventInput {
  title: string;
  description?: string;
  eventType: EventType;
  startTime: Date | string;
  endTime: Date | string;
  allDay?: boolean;
  location?: string;
  capacity?: number;
  relatedType?: string;
  relatedId?: string;
  attendeeUserIds?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  eventType?: EventType;
  startTime?: Date | string;
  endTime?: Date | string;
  allDay?: boolean;
  location?: string;
  status?: "scheduled" | "completed" | "cancelled";
  capacity?: number;
}

export interface SaveNotesInput {
  agenda?: string;
  notes?: string;
  decisions?: DecisionItem[];
  actionItems?: ActionItem[];
}

export interface AttendanceInput {
  status: "invited" | "accepted" | "declined" | "tentative";
  feedback?: string;
  rating?: number;
}

/**
 * Retrieves calendar events for a tenant within optional time ranges and category filters.
 */
export async function getCalendarEvents(
  tenantId: string,
  filter?: {
    start?: Date | string;
    end?: Date | string;
    eventType?: string;
  }
) {
  const where: any = { tenantId };

  if (filter?.eventType) {
    where.eventType = filter.eventType;
  }

  if (filter?.start || filter?.end) {
    where.AND = [];
    if (filter.start) {
      where.AND.push({
        endTime: { gte: new Date(filter.start) },
      });
    }
    if (filter.end) {
      where.AND.push({
        startTime: { lte: new Date(filter.end) },
      });
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      attendees: true,
      meetingNote: true,
    },
    orderBy: { startTime: "asc" },
  });

  return events;
}

/**
 * Retrieves a single calendar event by ID, asserting tenant isolation.
 */
export async function getCalendarEventById(tenantId: string, eventId: string) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, tenantId },
    include: {
      attendees: true,
      meetingNote: true,
    },
  });

  return event;
}

/**
 * Creates a new calendar event with multi-tenant scoping and attendee initialization.
 */
export async function createCalendarEvent(
  tenantId: string,
  organizerId: string,
  data: CreateEventInput
) {
  if (!data.title?.trim()) {
    throw new Error("TITLE_REQUIRED");
  }

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);

  if (!data.allDay && end <= start) {
    throw new Error("INVALID_TIME_RANGE");
  }

  const validTypes: EventType[] = [
    "meeting",
    "client_meeting",
    "interview",
    "review",
    "training",
    "holiday",
    "engagement",
  ];
  if (!validTypes.includes(data.eventType)) {
    throw new Error("INVALID_EVENT_TYPE");
  }

  const event = await prisma.calendarEvent.create({
    data: {
      tenantId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      eventType: data.eventType,
      startTime: start,
      endTime: end,
      allDay: Boolean(data.allDay),
      location: data.location?.trim() || null,
      organizerId,
      capacity: data.capacity && data.capacity > 0 ? data.capacity : null,
      relatedType: data.relatedType || null,
      relatedId: data.relatedId || null,
      status: "scheduled",
    },
  });

  // Automatically register organizer as accepted attendee
  const initialAttendees: { userId: string; status: string }[] = [
    { userId: organizerId, status: "accepted" },
  ];

  if (Array.isArray(data.attendeeUserIds)) {
    for (const uid of data.attendeeUserIds) {
      if (uid !== organizerId) {
        initialAttendees.push({ userId: uid, status: "invited" });
      }
    }
  }

  for (const attendee of initialAttendees) {
    await prisma.eventAttendee.create({
      data: {
        tenantId,
        eventId: event.id,
        userId: attendee.userId,
        status: attendee.status,
      },
    });
  }

  await writeAuditAsync({
    tenantId,
    actorUserId: organizerId,
    eventType: "calendar.event.create",
    resourceType: "calendar_event",
    resourceId: event.id,
    decision: "allow",
    metadata: {
      title: event.title,
      eventType: event.eventType,
      startTime: event.startTime.toISOString(),
      attendeeCount: initialAttendees.length,
    },
  });

  return getCalendarEventById(tenantId, event.id);
}

/**
 * Updates an existing calendar event.
 */
export async function updateCalendarEvent(
  tenantId: string,
  eventId: string,
  actorUserId: string,
  data: UpdateEventInput
) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!existing) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const start = data.startTime ? new Date(data.startTime) : existing.startTime;
  const end = data.endTime ? new Date(data.endTime) : existing.endTime;

  if (data.allDay === false && end <= start) {
    throw new Error("INVALID_TIME_RANGE");
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      title: data.title !== undefined ? data.title.trim() : undefined,
      description: data.description !== undefined ? data.description.trim() : undefined,
      eventType: data.eventType || undefined,
      startTime: data.startTime ? start : undefined,
      endTime: data.endTime ? end : undefined,
      allDay: data.allDay !== undefined ? data.allDay : undefined,
      location: data.location !== undefined ? data.location.trim() : undefined,
      status: data.status || undefined,
      capacity: data.capacity !== undefined ? data.capacity : undefined,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "calendar.event.update",
    resourceType: "calendar_event",
    resourceId: eventId,
    decision: "allow",
    metadata: { changes: Object.keys(data) },
  });

  return getCalendarEventById(tenantId, updated.id);
}

/**
 * Deletes a calendar event and associated attendees and notes.
 */
export async function deleteCalendarEvent(
  tenantId: string,
  eventId: string,
  actorUserId: string
) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!existing) {
    throw new Error("EVENT_NOT_FOUND");
  }

  await prisma.calendarEvent.delete({
    where: { id: eventId },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "calendar.event.delete",
    resourceType: "calendar_event",
    resourceId: eventId,
    decision: "allow",
    metadata: { title: existing.title },
  });

  return { success: true, id: eventId };
}

/**
 * Saves meeting notes, structured decisions, and action items.
 */
export async function saveMeetingNotes(
  tenantId: string,
  eventId: string,
  actorUserId: string,
  data: SaveNotesInput
) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const note = await prisma.meetingNote.upsert({
    where: { eventId },
    update: {
      agenda: data.agenda !== undefined ? data.agenda : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
      decisions: data.decisions ? (data.decisions as any) : undefined,
      actionItems: data.actionItems ? (data.actionItems as any) : undefined,
    },
    create: {
      tenantId,
      eventId,
      agenda: data.agenda || null,
      notes: data.notes || null,
      decisions: data.decisions ? (data.decisions as any) : [],
      actionItems: data.actionItems ? (data.actionItems as any) : [],
      createdBy: actorUserId,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "calendar.meeting_notes.save",
    resourceType: "meeting_notes",
    resourceId: note.id,
    decision: "allow",
    metadata: {
      eventId,
      decisionCount: Array.isArray(data.decisions) ? data.decisions.length : 0,
      actionItemCount: Array.isArray(data.actionItems) ? data.actionItems.length : 0,
    },
  });

  return note;
}

/**
 * Handles employee RSVP, attendance registration, and engagement feedback.
 */
export async function recordEventAttendance(
  tenantId: string,
  eventId: string,
  userId: string,
  data: AttendanceInput
) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, tenantId },
    include: { attendees: true },
  });

  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  // Enforce capacity limits on engagement/training events
  if (data.status === "accepted" && event.capacity) {
    const acceptedCount = event.attendees.filter(
      (a) => a.status === "accepted" && a.userId !== userId
    ).length;

    if (acceptedCount >= event.capacity) {
      throw new Error("EVENT_AT_CAPACITY");
    }
  }

  const attendee = await prisma.eventAttendee.upsert({
    where: {
      tenantId_eventId_userId: {
        tenantId,
        eventId,
        userId,
      },
    },
    update: {
      status: data.status,
      feedback: data.feedback !== undefined ? data.feedback : undefined,
      rating: data.rating !== undefined ? data.rating : undefined,
    },
    create: {
      tenantId,
      eventId,
      userId,
      status: data.status,
      feedback: data.feedback || null,
      rating: data.rating || null,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId: userId,
    eventType: "calendar.event.rsvp",
    resourceType: "event_attendee",
    resourceId: attendee.id,
    decision: "allow",
    metadata: {
      eventId,
      status: data.status,
      rating: data.rating ?? null,
    },
  });

  return attendee;
}

/**
 * Aggregates operational calendar metrics for executive & dashboard views.
 */
export async function getCalendarMetrics(tenantId: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [todayMeetings, upcomingHolidays, engagementEvents, notes] = await Promise.all([
    prisma.calendarEvent.count({
      where: {
        tenantId,
        startTime: { gte: startOfDay, lte: endOfDay },
        eventType: { in: ["meeting", "client_meeting", "interview", "review"] },
        status: "scheduled",
      },
    }),
    prisma.calendarEvent.count({
      where: {
        tenantId,
        startTime: { gte: now },
        eventType: "holiday",
      },
    }),
    prisma.calendarEvent.count({
      where: {
        tenantId,
        startTime: { gte: now },
        eventType: { in: ["engagement", "training"] },
      },
    }),
    prisma.meetingNote.findMany({
      where: { tenantId },
      select: { actionItems: true },
    }),
  ]);

  let pendingActionItems = 0;
  for (const n of notes) {
    if (Array.isArray(n.actionItems)) {
      pendingActionItems += (n.actionItems as unknown as ActionItem[]).filter(
        (a) => a.status === "open"
      ).length;
    }
  }

  return {
    todayMeetings,
    upcomingHolidays,
    engagementEvents,
    pendingActionItems,
  };
}
