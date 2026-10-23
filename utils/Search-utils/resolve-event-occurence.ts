import type { CalendarEvent } from "@/types/calendar";
import { doesEventOccurOnDate } from "@/stores/use-event-store";

function addDays(dateString: string, amount: number): string {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
}

function findOccurrence(
    event: CalendarEvent,
    startingDate: string,
    direction: 1 | -1,
    maxDays: number,
): string | null {
    const startDate = event.startDate.split("T")[0];
    const endDate = event.endDate?.split("T")[0];

    for (let offset = 0; offset < maxDays; offset++) {
        const date = addDays(startingDate, offset * direction);

        if (direction === 1 && endDate && date > endDate) break;
        if (direction === -1 && date < startDate) break;
        if (date < startDate) continue;

        if (doesEventOccurOnDate(event, date)) {
            return date;
        }
    }

    return null;
}

/**
 * Resolve one logical event to a valid occurrence:
 * 1. Its next occurrence on or after today.
 * 2. Otherwise, its most recent valid past occurrence.
 * 3. Null if it has no valid occurrences.
 */
export function resolveEventOccurrenceDate(
    event: CalendarEvent,
    today: string,
): string | null {
    const startDate = event.startDate.split("T")[0];
    const endDate = event.endDate?.split("T")[0];

    if (endDate && endDate < startDate) return null;

    // A non-recurring event has exactly one potential occurrence.
    if (event.recurrence === "none") {
        return doesEventOccurOnDate(event, startDate) ? startDate : null;
    }

    const deletedCount = event.deletedOccurrences?.length ?? 0;

    // Every deleted occurrence can make us skip one candidate.
    // Weekly events require up to seven calendar days per candidate.
    const maxSearchDays =
        event.recurrence === "weekly"
            ? (deletedCount + 2) * 7 + 7
            : deletedCount + 2;

    const futureStart = startDate > today ? startDate : today;

    const futureOccurrence = findOccurrence(
        event,
        futureStart,
        1,
        maxSearchDays,
    );

    if (futureOccurrence) return futureOccurrence;

    const yesterday = addDays(today, -1);
    const pastEnd = endDate && endDate < yesterday ? endDate : yesterday;

    if (pastEnd < startDate) return null;

    return findOccurrence(
        event,
        pastEnd,
        -1,
        maxSearchDays,
    );
}