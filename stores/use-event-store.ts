import { create } from "zustand";

import {
    batchRestore,
    batchUpdateEvents,
    countCalendarEvents,
    deleteAllCalendarEvents,
    deleteCalendarEvent,
    getAllCalendarEvents,
    insertCalendarEvent,
    updateCalendarEvent,
} from "@/db/repositories/event-repository";
import { CalendarEvent } from "@/types/calendar";

type EventValues = Partial<CalendarEvent>;

type EventStoreState = {
    eventsById: Record<string, CalendarEvent>;
    loaded: boolean;
    refreshing: boolean;

    addEvent: (event: CalendarEvent) => Promise<void>;
    editEvent: (event: CalendarEvent) => Promise<void>;
    removeEvent: (id: string) => Promise<void>;
    removeEvents: () => Promise<void>;

    reassignEventCategoryLocal: (oldCategoryId: string, newCategoryId: string) => void;
    reassignEventTagLocal: (oldTagId: string, newTagId: string | null) => void;

    eventCount: () => Promise<number>;

    batchMutateEvents: (eventsToMutate: CalendarEvent[], newValues: EventValues) => Promise<void>;
    batchRestoreEvents: (originalEvents: CalendarEvent[]) => Promise<void>;

    refreshEvents: () => Promise<Record<string, CalendarEvent>>;
};

const emptyEventsById = (): Record<string, CalendarEvent> => ({});

function normalizeEvents(events: CalendarEvent[]): Record<string, CalendarEvent> {
    const eventsById: Record<string, CalendarEvent> = {};
    for (const event of events) eventsById[event.id] = event;
    return eventsById;
}

function updateEventById(
    eventsById: Record<string, CalendarEvent>,
    id: string,
    updater: (event: CalendarEvent) => CalendarEvent,
): Record<string, CalendarEvent> {
    const current = eventsById[id];
    if (!current) return eventsById;
    const next = updater(current);
    if (next === current) return eventsById;
    return { ...eventsById, [id]: next };
}


export const selectedDateEventIds = (
    state: EventStoreState,
    date: Date,
) => {
    const dateIso = date.toISOString().split("T")[0];
    const dateDay = date.getDay();
    return Object.values(state.eventsById)
        .filter((event) => {
            const eventStartDatePart = event.startDate.split("T")[0];

            const dayOfWeek = new Date(eventStartDatePart).getDay();
            //TODOX Fix below ??
            const eventEndDatePart = event.endDate ? event.endDate.split("T")[0] : '5000-12-31';
            //const eventStartDateString = eventStartDate.toDateString();

            if (event.deletedOccurrences?.includes(dateIso)) return false;
            if (eventStartDatePart === dateIso) return true;
            if (event.recurrence === "daily") {
                if (
                    eventStartDatePart <= dateIso &&
                    dateIso <= eventEndDatePart
                )
                    return true;
            }
            if (event.recurrence === "weekly")
                if (
                    eventStartDatePart <= dateIso &&
                    dateIso <= eventEndDatePart &&
                    dayOfWeek === dateDay
                )
                    return true;

            return false;
        })
        .map((event) => event.id);
}
export const doesEventOccurOnDate = (event: CalendarEvent, dateString: string): boolean => {
    const eventStartDateString = event.startDate.split("T")[0];
    const eventEndDateString = event.endDate?.split("T")[0];

    if (dateString < eventStartDateString) return false;
    if (eventEndDateString && dateString > eventEndDateString) return false;
    if (event.deletedOccurrences?.includes(dateString)) return false;

    if (event.recurrence === "none" || !event.recurrence) {
        return eventStartDateString === dateString;
    }
    if (event.recurrence === "daily") return true;
    if (event.recurrence === "weekly") {
        return new Date(dateString).getDay() === new Date(event.startDate).getDay();
    }
    return false;
};

export const sortEventsByTime = (
    filtered: CalendarEvent[]
): CalendarEvent[] => {
    return [...filtered].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
};

export const getEventsForDate = (events: CalendarEvent[], date: Date): CalendarEvent[] => {
    const dateString = date.toISOString().split("T")[0];
    return sortEventsByTime(events.filter((event) => doesEventOccurOnDate(event, dateString)));
};

export const getEventIdsForDate = (events: CalendarEvent[], dateString: string): string[] => {
    return events
        .filter((event) => doesEventOccurOnDate(event, dateString))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((event) => event.id);
};



export const isSingleOccurrence = (id: string) => {
    const event = useEventStore.getState().eventsById[id];
    if (event.recurrence === "none") return true;
    if (!event.endDate) return false;
    const start = new Date(event.startDate.split("T")[0]);
    const end = new Date(event.endDate.split("T")[0]);
    const dayDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    let totalOccurrences = 0;
    if (event.recurrence === "daily") {
        totalOccurrences = dayDiff + 1;
    } else if (event.recurrence === "weekly") {
        totalOccurrences = Math.floor(dayDiff / 7) + 1;
    }
    // fallback safety
    else {
        totalOccurrences = 1;
    }
    const deletedOcurrencesCount = event.deletedOccurrences?.length || 0;
    const remainingOccurrences = totalOccurrences - deletedOcurrencesCount;
    return remainingOccurrences === 1;
};

export const useEventStore = create<EventStoreState>((set, get) => {
    const pendingOpByEventId = new Map<string, symbol>();

    const applyOptimisticMutation = async (
        affectedIds: string[],
        optimisticUpdate: (eventsById: Record<string, CalendarEvent>) => Record<string, CalendarEvent>,
        dbWrite: () => Promise<unknown>,
    ): Promise<void> => {
        const opId = Symbol();
        for (const id of affectedIds) pendingOpByEventId.set(id, opId);

        const previousById = get().eventsById;
        set((state) => ({ eventsById: optimisticUpdate(state.eventsById) }));

        try {
            await dbWrite();
        } catch (error) {
            set((state) => {
                const next = { ...state.eventsById };
                let rolledBackAny = false;
                for (const id of affectedIds) {
                    if (pendingOpByEventId.get(id) !== opId) continue;
                    if (previousById[id]) next[id] = previousById[id];
                    else delete next[id];
                    rolledBackAny = true;
                }
                return rolledBackAny ? { eventsById: next } : state;
            });
            throw error;
        } finally {
            for (const id of affectedIds) {
                if (pendingOpByEventId.get(id) === opId) pendingOpByEventId.delete(id);
            }
        }
    };

    return {
        eventsById: emptyEventsById(),
        loaded: false,
        refreshing: false,

        addEvent: async (event) => {
            await applyOptimisticMutation(
                [event.id],
                (eventsById) =>
                    eventsById[event.id] ? eventsById : { ...eventsById, [event.id]: event },
                () => insertCalendarEvent(event),
            );
        },

        editEvent: async (event) => {
            await applyOptimisticMutation(
                [event.id],
                (eventsById) =>
                    eventsById[event.id] ? { ...eventsById, [event.id]: event } : eventsById,
                () => updateCalendarEvent(event),
            );
        },

        removeEvent: async (id) => {
            await applyOptimisticMutation(
                [id],
                (eventsById) => {
                    if (!eventsById[id]) return eventsById;
                    const next = { ...eventsById };
                    delete next[id];
                    return next;
                },
                () => deleteCalendarEvent(id),
            );
        },

        removeEvents: async () => {
            await deleteAllCalendarEvents();
            set({ eventsById: emptyEventsById() });
        },

        reassignEventCategoryLocal: (oldCategoryId, newCategoryId) => {
            set((state) => {
                let changed = false;
                const next = { ...state.eventsById };
                for (const id in next) {
                    const event = next[id];
                    if (event.category !== oldCategoryId) continue;
                    changed = true;
                    next[id] = { ...event, category: newCategoryId };
                }
                return changed ? { eventsById: next } : state;
            });
        },

        reassignEventTagLocal: (oldTagId, newTagId) => {
            set((state) => {
                let changed = false;
                const next = { ...state.eventsById };
                for (const id in next) {
                    const event = next[id];
                    if (!event.tags?.includes(oldTagId)) continue;
                    const nextTags = event.tags.filter((t) => t !== oldTagId);
                    if (newTagId && !nextTags.includes(newTagId)) nextTags.push(newTagId);
                    changed = true;
                    next[id] = { ...event, tags: nextTags };
                }
                return changed ? { eventsById: next } : state;
            });
        },

        eventCount: async () => (await countCalendarEvents()) ?? 0,

        batchMutateEvents: async (eventsToMutate, newValues) => {
            if (eventsToMutate.length === 0) return;
            const idsToMutate = eventsToMutate.map((e) => e.id);
            const updatedAt = new Date().toISOString();

            await applyOptimisticMutation(
                idsToMutate,
                (eventsById) => {
                    const next = { ...eventsById };
                    for (const id of idsToMutate) {
                        const event = next[id];
                        if (!event) continue;
                        next[id] = { ...event, ...newValues, updatedAt };
                    }
                    return next;
                },
                () => batchUpdateEvents(eventsToMutate, newValues),
            );
        },

        batchRestoreEvents: async (originalEvents) => {
            if (originalEvents.length === 0) return;
            const idsToRestore = originalEvents.map((e) => e.id);
            const updatedAt = new Date().toISOString();

            await applyOptimisticMutation(
                idsToRestore,
                (eventsById) => {
                    const next = { ...eventsById };
                    for (const event of originalEvents) {
                        if (!next[event.id]) continue;
                        next[event.id] = { ...event, updatedAt };
                    }
                    return next;
                },
                () => batchRestore(originalEvents),
            );
        },

        refreshEvents: async () => {
            set({ refreshing: true });
            try {
                const loadedEvents = await getAllCalendarEvents();
                set({ eventsById: normalizeEvents(loadedEvents), loaded: true });
                return get().eventsById;
            } finally {
                set({ refreshing: false });
            }
        },
    };
});