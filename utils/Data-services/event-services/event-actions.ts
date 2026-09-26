// utils/event/event-actions.ts
import { useEventStore } from "@/stores/use-event-store";
import { cancelReminder, scheduleReminderEvents } from "@/hooks/use-notifications";
import { CalendarEvent } from "@/types/calendar";
import { GlobalMetricKey } from "@/types/metrics";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

const isTimeEdited = (oldEvent: CalendarEvent, newEvent: CalendarEvent) => {
    // If old event never had a reminder
    if (!oldEvent.reminder) return false;
    // Either old event had end date and edited event doesnt or edited has it and old doesnt
    if ((oldEvent.endDate && !newEvent.endDate) || (!oldEvent.endDate && newEvent.endDate)) return true
    // Neither have end date so only compare if startDate/Time are diff
    if (!oldEvent.endDate && !newEvent.endDate) {
        return (
            oldEvent.startDate.split("T")[0] !== newEvent.startDate.split("T")[0] ||
            oldEvent.startTime.split("T")[1] !== newEvent.startTime.split("T")[1] ||
            oldEvent.endTime.split("T")[1] !== newEvent.endTime.split("T")[1]
        );
    }
    // If execution reaches here then oldEvent and newEvent will have an end date, adding ! after for non-null assertion to overcome type checker cries
    return (
        oldEvent.startDate.split("T")[0] !== newEvent.startDate.split("T")[0] ||
        oldEvent.endDate!.split("T")[0] !== newEvent.endDate!.split("T")[0] ||
        oldEvent.startTime.split("T")[1] !== newEvent.startTime.split("T")[1] ||
        oldEvent.endTime.split("T")[1] !== newEvent.endTime.split("T")[1] ||
        oldEvent.recurrence !== newEvent.recurrence
    );
};

const cancelAllRemniders = async (notifications: { date: string; id: string }[]) => {
    notifications?.forEach((n) => cancelReminder(n.id));
};

export async function addEventWithEffects(event: CalendarEvent, actor: 'user' | 'ai' = 'user'): Promise<void> {
    if (event.reminder) {
        const notificationIds = await scheduleReminderEvents(event);
        event.notificationIds = notificationIds
    }
    await useEventStore.getState().addEvent(event);
    const metricsArr: GlobalMetricKey[] = ["eventsAdded"];
    if (event.recurrence === "daily" && event.endDate) {
        metricsArr.push("eventsDaily");
    } else if (event.recurrence === "weekly" && event.endDate) {
        metricsArr.push("eventsWeekly");
    } else if (event.recurrence === "none") {
        metricsArr.push("eventsSingleton");
    } else {
        metricsArr.push("eventsInfinite");
    }
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const startSeconds =
        start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds();

    const endSeconds =
        end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds();

    const SIX_AM = 6 * 3600;
    const NINE_AM = 9 * 3600;
    const NINE_PM = 21 * 3600;
    const END_OF_DAY = 23 * 3600 + 59 * 60 + 59;

    if (startSeconds >= SIX_AM && endSeconds <= NINE_AM) {
        metricsArr.push("eventsEarlymorning");
    } else if (startSeconds >= NINE_PM && endSeconds <= END_OF_DAY) {
        metricsArr.push("eventsLatenight");
    } else if (startSeconds >= NINE_PM || endSeconds <= SIX_AM) {
        metricsArr.push("eventsOvernight");
    }
    metricsEventBus.emit("metric:track", { keys: metricsArr, amount: 1, actor });
}

export async function editEventWithEffects(event: CalendarEvent, actor: 'user' | 'ai' = 'user'): Promise<void> {
    const oldEvent = useEventStore.getState().eventsById[event.id];

    // If both had reminders ON and time was edited
    if (isTimeEdited(oldEvent, event) && oldEvent?.notificationIds) {
        console.log("EVENT FORM NOtifs: new reminder old:1 , new:1");
        await cancelAllRemniders(oldEvent.notificationIds)
        const notifIds = await scheduleReminderEvents(event);
        event.notificationIds = notifIds;
    }

    await useEventStore.getState().editEvent(event);
    metricsEventBus.emit("metric:track", { keys: ["eventsEdited"], amount: 1, actor });
}

export async function deleteEventWithEffects(id: string, actor: 'user' | 'ai' = 'user'): Promise<void> {
    await useEventStore.getState().removeEvent(id);
    metricsEventBus.emit("metric:track", { keys: ["eventsDeleted"], amount: 1, actor });
}

export async function deleteEventOccurrenceWithEffects(
    eventId: string,
    date: string,
    all: boolean,
    actor: 'user' | 'ai' = "user",
): Promise<void> {
    const event = useEventStore.getState().eventsById[eventId];
    if (!event) return;
    if (all) {
        if (event.notificationIds?.length) {
            await Promise.all(event.notificationIds.map((n) => cancelReminder(n.id)));
        }
        await useEventStore.getState().removeEvent(eventId);
        metricsEventBus.emit("metric:track", { keys: ["eventsDeleted"], amount: 1, actor });
        return;
    }

    const notifId = event.notificationIds?.find((n) => n.date === date)?.id;
    if (notifId) {
        await cancelReminder(notifId);
    }

    await useEventStore.getState().editEvent({
        ...event,
        deletedOccurrences: [...(event.deletedOccurrences || []), date],
        notificationIds: event.notificationIds?.filter((n) => n.date !== date),
    });
}

export async function deleteAllEventsWithEffects(actor: 'user' | 'ai' = "user"): Promise<void> {
    const deletedEventsCount = Object.keys(useEventStore.getState().eventsById).length;
    await useEventStore.getState().removeEvents();
    metricsEventBus.emit("metric:track", { keys: ["eventsDeleted"], amount: deletedEventsCount, actor });
}

export function reassignEventCategoryWithEffects(oldCategoryId: string, newCategoryId: string): void {
    useEventStore.getState().reassignEventCategoryLocal(oldCategoryId, newCategoryId);
}

export function reassignEventTagWithEffects(oldTagId: string, newTagId: string | null): void {
    useEventStore.getState().reassignEventTagLocal(oldTagId, newTagId);
}

export async function eventCountWithEffects(): Promise<number> {
    return useEventStore.getState().eventCount();
}

export async function batchMutateEventsWithEffects(
    eventsToMutate: CalendarEvent[],
    newValues: Partial<CalendarEvent>,
): Promise<void> {
    await useEventStore.getState().batchMutateEvents(eventsToMutate, newValues);
}

export async function batchRestoreEventsWithEffects(originalEvents: CalendarEvent[]): Promise<void> {
    await useEventStore.getState().batchRestoreEvents(originalEvents);
}

export async function refreshEventsWithEffects(): Promise<Record<string, CalendarEvent>> {
    return useEventStore.getState().refreshEvents();
}

