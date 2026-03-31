import { eq, desc, inArray } from "drizzle-orm";
import { db, calendarEvents, eventDeletedOccurrences, eventNotificationIds } from "@/db";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarEventRow, CalendarEventInsert, EventDeletedOccurrenceRow, EventNotificationIdRow } from "@/db/schema";

// ─── private: parent row converter ───────────────────────────────────────────
//
// Intentionally private — only assembleCalendarEvent() produces a full CalendarEvent.
// rowToCalendarEvent handles the scalar fields on the calendarEvents table only.
// history / freezeHistory / goalCompletions are NOT populated here.

function rowToCalendarEvent(
    row: CalendarEventRow,
    deletedOccurrences: EventDeletedOccurrenceRow[],
    notificationIds: EventNotificationIdRow[],
): CalendarEvent {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        startDate: row.startDate,
        startTime: row.startTime,
        endTime: row.endTime,
        endDate: row.endDate ?? undefined,
        recurrence: row.recurrence ?? "none" as "none" | "daily" | "weekly",
        reminder: row.reminder,
        // FIXED: reminderDate stored as INTEGER (unix ms), convert back to Date
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedOccurrences: deletedOccurrences.length > 0 ? deletedOccurrences.map((r) => r.date) : undefined,
        notificationIds: notificationIds.length > 0 ? notificationIds.map(
            (r) => ({
                date: r.date,
                id: r.id,
            }),
        ) : undefined,
    };
}

// ─── private: child row builders ─────────────────────────────────────────────

function buildEventDeletedOccurrenceRows(
    event: CalendarEvent,
): Omit<EventDeletedOccurrenceRow, never>[] {
    return (event.deletedOccurrences ?? []).map((date) => ({
        id: `${event.id}_ci_${date}`,   // deterministic id — safe to re-insert
        eventId: event.id,
        date,
    }));
}

function buildEventNotificationIdRows(
    event: CalendarEvent,
): Omit<EventNotificationIdRow, never>[] {
    return (event.notificationIds ?? []).map((notif) => ({
        id: notif.id,   // deterministic id
        eventId: event.id,
        date: notif.date,
    }));
}


// ─── private: fetch child rows for one or many calendarEvents ────────────────────────

interface ChildRows {
    deletedOccurrences: EventDeletedOccurrenceRow[],
    notificationIds: EventNotificationIdRow[],
}

/** Fetch all child rows for a single event id. */
async function fetchChildRowsForOne(eventId: string): Promise<ChildRows> {
    const [deletedOccurrences, notificationIds] = await Promise.all([
        db.select().from(eventDeletedOccurrences).where(eq(eventDeletedOccurrences.eventId, eventId)),
        db.select().from(eventNotificationIds).where(eq(eventNotificationIds.eventId, eventId)),
    ]);
    return { deletedOccurrences,notificationIds };
}

/**
 * Fetch child rows for many calendarEvents in 3 queries (not N*3).
 * Returns a map keyed by eventId so assembly is O(1) per event.
 */
async function fetchChildRowsForMany(
    eventIds: string[],
): Promise<Map<string, ChildRows>> {
    if (eventIds.length === 0) return new Map();

    const [allDeletedOccurrences, allNotificationIds] = await Promise.all([
        db.select().from(eventDeletedOccurrences).where(inArray(eventDeletedOccurrences.eventId, eventIds)),
        db.select().from(eventNotificationIds).where(inArray(eventNotificationIds.eventId, eventIds)),,
    ]);

    // Group by eventId
    const map = new Map<string, ChildRows>();
    for (const id of eventIds) {
        map.set(id, { deletedOccurrences: [], notificationIds: [] });
    }
    for (const row of allDeletedOccurrences) map.get(row.eventId)!.deletedOccurrences.push(row);
    for (const row of allNotificationIds) map.get(row.eventId)!.notificationIds.push(row);

    return map;
}

// ─── parent row insert shape ──────────────────────────────────────────────────

function eventToInsert(event: CalendarEvent): CalendarEventInsert {
    const now = new Date().toISOString();
    return {
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        startDate: event.startDate,
        startTime: event.startTime,
        endTime: event.endTime,
        endDate: event.endDate ?? null,
        recurrence: event.recurrence ?? "none",
        reminder: event.reminder,
        // FIXED: convert Date → unix ms for INTEGER column
        embedding: event.embedding ? JSON.stringify(event.embedding) : null,
        createdAt: event.createdAt ?? now,
        updatedAt: now,
    };
}

// ─── read operations ──────────────────────────────────────────────────────────

/** Load all calendarEvents with their full child data. 3 + 1 queries total, not N*3. */
export async function getAllCalendarEvents(): Promise<CalendarEvent[]> {
    const rows = await db
        .select()
        .from(calendarEvents)
        .orderBy(desc(calendarEvents.createdAt));

    if (rows.length === 0) return [];

    const eventIds = rows.map((r) => r.id);
    const childMap = await fetchChildRowsForMany(eventIds);

    return rows.map((row) => {
        const children = childMap.get(row.id) ?? {
            deletedOccurrences : [], notificationIds: []
        };
        return rowToCalendarEvent(row, children.deletedOccurrences, children.notificationIds);
    });
}

/** Load a single event with all child data. */
export async function getCalendarEventById(id: string): Promise<CalendarEvent | null> {
    const rows = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, id))
        .limit(1);

    if (rows.length === 0) return null;

    const { deletedOccurrences, notificationIds } = await fetchChildRowsForOne(id);
    return rowToCalendarEvent(rows[0], deletedOccurrences, notificationIds);
}

// ─── write operations ─────────────────────────────────────────────────────────

/**
 * Insert a new event with all child rows in a single transaction.
 * Throws on DB error.
 */
export async function insertCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const deletedOccurrencesRows = buildEventDeletedOccurrenceRows(event);
    const notificationIdRows = buildEventNotificationIdRows(event);

    await db.transaction(async (tx) => {
        await tx.insert(calendarEvents).values(eventToInsert(event));

        if (deletedOccurrencesRows.length > 0) {
            await tx.insert(eventDeletedOccurrences).values(deletedOccurrencesRows);
        }
        if (notificationIdRows.length > 0) {
            await tx.insert(eventNotificationIds).values(notificationIdRows);
        }
    });

    // Return the full assembled event
    return event;
}

/**
 * Update a event. Replaces all child rows (delete + reinsert) in one transaction.
 *
 * Why delete + reinsert instead of diffing?
 * Check-ins and freezes are append-only in practice, but goalCompletions
 * can be modified (goal value changes). A full replace is simpler and safe —
 * the transaction guarantees atomicity so there's no window where child rows
 * are missing.
 */
export async function updateCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const deletedOccurrencesRows = buildEventDeletedOccurrenceRows(event);
    const notificationIdRows = buildEventNotificationIdRows(event);

    await db.transaction(async (tx) => {
        // Update parent
        await tx
            .update(calendarEvents)
            .set({ ...eventToInsert(event), updatedAt: new Date().toISOString() })
            .where(eq(calendarEvents.id, event.id));

        // Replace children — delete all then reinsert
        await tx.delete(eventDeletedOccurrences).where(eq(eventDeletedOccurrences.eventId, event.id));
        await tx.delete(eventNotificationIds).where(eq(eventNotificationIds.eventId, event.id));

        if (deletedOccurrencesRows.length > 0) {
            await tx.insert(eventDeletedOccurrences).values(deletedOccurrencesRows);
        }
        if ( notificationIdRows.length > 0) {
            await tx.insert(eventNotificationIds).values(notificationIdRows);
        }
    });

    return event;
}

/**
 * Delete a event and all its child rows.
 * ON DELETE CASCADE in the schema handles child deletion automatically.
 */
export async function deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

// ─── bulk operations ──────────────────────────────────────────────────────────

/**
 * Insert multiple calendarEvents with all their child rows.
 * Used by the AsyncStorage → SQLite migration.
 */
export async function bulkInsertCalendarEvents(eventList: CalendarEvent[]): Promise<void> {
    if (eventList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const event of eventList) {
            // Parent — skip if already exists
            await tx
                .insert(calendarEvents)
                .values(eventToInsert(event))
                .onConflictDoNothing();

            // Children — onConflictDoNothing is safe because ids are deterministic
            const deletedOccurrencesRows = buildEventDeletedOccurrenceRows(event);
    const notificationIdRows = buildEventNotificationIdRows(event);

            if (deletedOccurrencesRows.length > 0) {
                await tx.insert(eventDeletedOccurrences).values(deletedOccurrencesRows).onConflictDoNothing();
            }
            if (notificationIdRows.length > 0) {
                await tx.insert(eventNotificationIds).values(notificationIdRows).onConflictDoNothing();
            }
        }
    });
}

export async function countCalendarEvents(): Promise<number> {
    const result = await db.select({ id: calendarEvents.id }).from(calendarEvents);
    return result.length;
}