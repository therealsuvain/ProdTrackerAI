import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FAB, Portal } from "react-native-paper";

import ViewSwitcher from "@/components/ui/calendar-events/view-switcher-event";
import { useCalendarState } from "@/hooks/context-hooks/use-calendar-state";
import { useEventForm } from "@/hooks/use-forms/use-event-form";
import { CalendarEvent } from "@/types/calendar";

import { useDbErrorToast } from "@/components/shared/db-error-toast";
import CalendarEventModal from "@/components/modal/calendar-event-modal";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import Timeline from "@/components/ui/calendar-events/calendar-timeline-view";
import CalendarListAgendaV2 from "@/components/ui/calendar-events/v2-calendar-list-agenda-view-v2";
import { ThemeContext } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/use-haptics";
import CalendarListAgendaMain from "@/components/ui/calendar-events/calendar-list-agenda-view-main";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
import {
  AppDialog,
  DialogAction,
} from "@/components/shared/dialog-system/AppDialog";
import {
  addEventWithEffects,
  editEventWithEffects,
  deleteEventOccurrenceWithEffects,
} from "@/utils/Data-services/event-services/event-actions";
import { useEventStore } from "@/stores/use-event-store";
import { EventDetailsHost } from "@/components/ui/calendar-events/event-details-host";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doesEventOccurOnDate } from "@/stores/use-event-store";

type PendingCalendarEventFocus = {
  eventId: string;
  occurrenceDate: string;
  requestId: string;
};

// TODOX - can we getting db write error from useItemForm hook into ItemScreen and display toast?
function CalendarScreenInner() {
  const { theme } = useContext(ThemeContext);
  const {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
  } = useCalendarState();
  const [visible, setVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const { showToast } = useDbErrorToast();
  const { triggerHaptic } = useHaptics();
  const [pendingEventFocus, setPendingEventFocus] =
    useState<PendingCalendarEventFocus | null>(null);

  const [agendaFocusEpoch, setAgendaFocusEpoch] = useState(0);

  const handledEventFocusRequest = useRef<string | null>(null);

  const eventsLoaded = useEventStore((state) => state.loaded);
  const router = useRouter();

  const {
    openAdd,
    openAddRequest,
    focusItemId,
    focusItemType,
    focusRequestId,
    occurrenceDate,
  } = useLocalSearchParams<{
    openAdd?: string;
    openAddRequest?: string;
    focusItemId?: string;
    focusItemType?: string;
    focusRequestId?: string;
    occurrenceDate?: string;
  }>();

  const handledOpenAddRequest = useRef<string | null>(null);

  const { state, updateField, onSubmit } = useEventForm({
    addEvent: addEventWithEffects,
    editEvent: editEventWithEffects,
    editingEvent,
    onClose: () => setVisible(false),
    resetEditingEvent: () => setEditingEvent(null),
  });
  const [deleteEventDialogActions, setDeleteEventDialogActions] = useState<
    DialogAction[] | null
  >(null);
  const showModal = (event?: CalendarEvent) => {
    if (event) {
      setIsEditing(true);
      setEditingEvent(event);
      setVisible(true);
      return;
    }
    setEditingEvent(null);
    setIsEditing(false);
    setVisible(true);
  };

  const hideModal = () => {
    setIsEditing(false);
    setVisible(false);
  };

  const isSingleOccurrenceHelper = (event: CalendarEvent) => {
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

  const handleDelete = useCallback((id: string, date: string) => {
    const event = useEventStore.getState().eventsById[id];
    if (!event) return;
    const isSingleOccurrence = isSingleOccurrenceHelper(event);
    const buttons: DialogAction[] = [];
    if (!isSingleOccurrence) {
      buttons.push({
        label: "Delete Current Occurrence",
        variant: "destructive",
        onPress: async () => {
          try {
            await deleteEventOccurrenceWithEffects(id, date, false);
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          } finally {
            setDeleteEventDialogActions(null);
          }
        },
      });
    }
    buttons.push(
      {
        label: "Cancel",
        onPress: () => {
          setDeleteEventDialogActions(null);
        },
      },
      {
        label: "Delete Event",
        variant: "destructive",
        onPress: async () => {
          try {
            await deleteEventOccurrenceWithEffects(id, date, true);
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          } finally {
            setDeleteEventDialogActions(null);
          }
        },
      },
    );
    setDeleteEventDialogActions(buttons);
  }, []);

  const handleEditRow = useCallback(
    (id: string) => {
      const event = useEventStore.getState().eventsById[id];
      if (event) showModal(event);
    },
    [showModal],
  );

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleCalendarFocusRequestHandled = useCallback((requestId: string) => {
    setPendingEventFocus((current) =>
      current?.requestId === requestId ? null : current,
    );
  }, []);

  const handleCalendarFocusRequestFailed = useCallback(
    (requestId: string) => {
      setPendingEventFocus((current) =>
        current?.requestId === requestId ? null : current,
      );

      showToast(
        "Couldn't bring this event occurrence into view. Open it from the calendar instead.",
      );
    },
    [showToast],
  );

  useEffect(() => {
    if (
      openAdd !== "1" ||
      !openAddRequest ||
      handledOpenAddRequest.current === openAddRequest
    ) {
      return;
    }

    // Prevent this request from opening the modal more than once.
    handledOpenAddRequest.current = openAddRequest;

    showModal();

    // Clear the request so it won't be replayed on a later visit.
    router.setParams({
      openAdd: undefined,
      openAddRequest: undefined,
    });
  }, [openAdd, openAddRequest, router, showModal]);

  useEffect(() => {
    if (
      focusItemType !== "event" ||
      !focusItemId ||
      !focusRequestId ||
      !occurrenceDate ||
      handledEventFocusRequest.current === focusRequestId
    ) {
      return;
    }

    // Wait for the initial event-store load before deciding the target is gone.
    if (!eventsLoaded) return;

    const event = useEventStore.getState().eventsById[focusItemId];

    const consumeParams = () => {
      router.setParams({
        focusItemId: undefined,
        focusItemType: undefined,
        focusRequestId: undefined,
        occurrenceDate: undefined,
      });
    };

    // Revalidate against the current event data. The occurrence could have
    // been removed or edited while the search screen was open.
    if (!event || !doesEventOccurOnDate(event, occurrenceDate)) {
      handledEventFocusRequest.current = focusRequestId;
      showToast("This event occurrence is no longer available.");
      consumeParams();
      return;
    }

    handledEventFocusRequest.current = focusRequestId;

    // Agenda must be in month view so the target pill exists.
    setCurrentView("month");

    // Preserve the ISO calendar day. Using UTC noon avoids shifting the
    // date backwards when the date string is parsed in local time.
    setSelectedDate(new Date(`${occurrenceDate}T12:00:00.000Z`));

    setPendingEventFocus({
      eventId: focusItemId,
      occurrenceDate,
      requestId: focusRequestId,
    });

    // Remount the Agenda for this explicit navigation request so its
    // initial selected day and loaded date range are the target occurrence.
    setAgendaFocusEpoch((current) => current + 1);

    // The request is now safely stored in local state.
    consumeParams();
  }, [
    focusItemId,
    focusItemType,
    focusRequestId,
    occurrenceDate,
    eventsLoaded,
    router,
    setCurrentView,
    setSelectedDate,
    showToast,
  ]);

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.eventDarkSecondary },
        ]}
      >
        <Pressable
          style={[styles.header, { backgroundColor: theme.eventBase }]}
          onPress={() => setSelectedDate(new Date())}
        >
          <Ionicons size={32} name="today" color={theme.whiteBase}></Ionicons>
        </Pressable>
        <Text style={[styles.date, { color: theme.text }]}>
          {selectedDate.toDateString()}
        </Text>
      </View>

      <ViewSwitcher currentView={currentView} onChange={setCurrentView} />

      {currentView === "month" ? (
        <CalendarListAgendaMain
          key={agendaFocusEpoch}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          focusRequest={pendingEventFocus ?? undefined}
          onFocusRequestHandled={handleCalendarFocusRequestHandled}
          onFocusRequestFailed={handleCalendarFocusRequestFailed}
        />
      ) : (
        <Timeline
          eventIds={filteredEvents}
          selectedDate={selectedDate}
          onEventSelect={handleEditRow}
          onDelete={handleDelete}
        />
      )}
      <FAB
        color={theme.eventDarkPrimary}
        style={[styles.fab, { backgroundColor: theme.eventBase }]}
        icon="plus"
        onPress={() => showModal()}
      />

      <Portal>
        <CalendarEventModal
          visible={visible}
          onDismiss={hideModal}
          updateField={updateField}
          state={state}
          onSubmit={onSubmit}
          editingEvent={editingEvent}
        ></CalendarEventModal>
      </Portal>
      {deleteEventDialogActions && (
        <AppDialog
          visible
          title={"Delete Event"}
          description={"Are you sure?"}
          onDismiss={() => setDeleteEventDialogActions(null)}
          dismissable={false}
          actions={deleteEventDialogActions}
        />
      )}
      <EventDetailsHost onEdit={handleEditRow} onDelete={handleDelete} />
    </>
  );
}

export default function CalendarScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const isReady = useScreenReady();
  if (!isReady) return <EntitySkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Calendar">
      <CalendarScreenInner />
    </ScreenErrorBoundary>
  );
}
const styles = StyleSheet.create({
  header: {
    borderRadius: 24,
    width: 48,
    height: 48,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  container: { flexDirection: "row", alignItems: "center" },
  viewSwitcher: {},
  date: { fontSize: 20 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
