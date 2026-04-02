import { CalendarEvent } from "@/types/calendar";
import { useReducer } from "react";
import { useEffect } from "react";
import { validateEventTimes } from "@/utils/event-utils";
import { randomUUID } from "expo-crypto";
import { cancelReminder, scheduleReminderEvents } from "./use-notifications";
import { generateEmbedding } from '@/utils/embedding-engine'

type FormState = Omit<CalendarEvent, "id"> & {
  errors: Partial<
    Record<keyof Omit<CalendarEvent, "id">, string>
  >;
};

type FormAction =
  | { type: "UPDATE_FIELD"; payload: { field: keyof FormState; value: any } }
  | { type: "SET_ERROR"; payload: { field: keyof FormState; message: string } }
  | { type: "CLEAR_ERRORS" }
  | { type: "RESET"; payload?: Partial<FormState> };

const initialState: FormState = {
  title: "",
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  reminder: false,
  recurrence: "none",
  errors: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "UPDATE_FIELD":
      return {
        ...state,
        [action.payload.field]: action.payload.value,
        errors: { ...state.errors, [action.payload.field]: undefined }, // Clear error on change
      };
    case "SET_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };
    case "CLEAR_ERRORS":
      return { ...state, errors: {} };
    case "RESET":
      return { ...initialState, ...action.payload };
    default:
      return state;
  }
};

interface UseEventFormProps {
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
}

const cancelAllRemniders = async (notifications: { date: string; id: string }[]) => {
  notifications?.forEach((n) => cancelReminder(n.id));
};

const isTimeEdited = (editingEvent: CalendarEvent | null, newEvent: CalendarEvent) => {
  // If this is a new event
  if (!editingEvent) return false;
  // If old event never had a reminder
  if (!editingEvent.reminder) return false;
  // Either old event had end date and edited event doesnt or edited has it and old doesnt
  if ((editingEvent.endDate && !newEvent.endDate) || (!editingEvent.endDate && newEvent.endDate)) return true
  // Neither have end date so only compare if startDate/Time are diff
  if (!editingEvent.endDate && !newEvent.endDate) {
    return (
      editingEvent.startDate.split("T")[0] !== newEvent.startDate.split("T")[0] ||
      editingEvent.startTime.split("T")[1] !== newEvent.startTime.split("T")[1] ||
      editingEvent.endTime.split("T")[1] !== newEvent.endTime.split("T")[1]
    );
  }
  // If execution reaches here then editingEvent and newEvent will have an end date, adding ! after for non-null assertion to overcome type checker cries
  return (
    editingEvent.startDate.split("T")[0] !== newEvent.startDate.split("T")[0] ||
    editingEvent.endDate!.split("T")[0] !== newEvent.endDate!.split("T")[0] ||
    editingEvent.startTime.split("T")[1] !== newEvent.startTime.split("T")[1] ||
    editingEvent.endTime.split("T")[1] !== newEvent.endTime.split("T")[1] ||
    editingEvent.recurrence !== newEvent.recurrence
  );
};

export const useEventForm = ({
  addEvent,
  editEvent,
  editingEvent,
  onClose,
}: UseEventFormProps) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  useEffect(() => {
    if (editingEvent) {
      dispatch({
        type: "RESET",
        payload: {
          title: editingEvent.title,
          startDate: editingEvent.startDate,
          endDate: editingEvent.endDate,
          startTime: editingEvent.startTime,
          endTime: editingEvent.endTime,
          description: editingEvent.description,
          reminder: editingEvent.reminder,
          recurrence: editingEvent.recurrence,
          deletedOccurrences: editingEvent.deletedOccurrences,
          category: editingEvent.category,
          notificationIds: editingEvent.notificationIds,
          createdAt: editingEvent.createdAt,
          updatedAt: editingEvent.updatedAt,
          embedding: editingEvent.embedding
        },
      });
    } else {
      dispatch({ type: "RESET" });
    }
  }, [editingEvent]);

  const updateField = (field: keyof FormState, value: any) => {
    dispatch({ type: "UPDATE_FIELD", payload: { field, value } });
  };

  const onSubmit = async () => {
    dispatch({ type: "CLEAR_ERRORS" });
    let hasError = false;

    if (!state.title) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "title", message: "Title is required" },
      });
      hasError = true;
    }
    if (!state.startDate) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "startDate", message: "Start time is required" },
      });
      hasError = true;
    }
    if (!state.startTime) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "startTime", message: "Start time is required" },
      });
      hasError = true;
    }
    if (!state.endTime) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "endTime", message: "Start time is required" },
      });
      hasError = true;
    }
    if (!validateEventTimes(new Date(state.startTime), new Date(state.endTime))) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "endTime", message: "End time must be after start" },
      });
      hasError = true;
    }

    if (hasError) return;

    let newEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : randomUUID(),
      ...state,
      createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      embedding: state.embedding || await generateEmbedding(state.title, false)
    };

    // If old had reminders ON and new edited doesnt
    if (
      editingEvent &&
      editingEvent.reminder &&
      editingEvent.notificationIds &&
      !newEvent.reminder
    ) {
      cancelAllRemniders(editingEvent.notificationIds);
    }

    /* 
    if (editingEvent && editingEvent.notificationId) {
      await cancelReminder(editingEvent.notificationId);
    } */

    // If old didnt have reminders ON and new edited does
    if (newEvent.reminder && !editingEvent?.reminder) {
      console.log("new reminders")
      const notifIds = await scheduleReminderEvents(newEvent);
      newEvent.notificationIds = notifIds;
    }

    // If both had reminders ON and time was edited
    if (isTimeEdited(editingEvent, newEvent) && editingEvent?.notificationIds) {
      console.log("old cancelled")
      await cancelAllRemniders(editingEvent.notificationIds)
      const notifIds = await scheduleReminderEvents(newEvent);
      newEvent.notificationIds = notifIds;
    }
    if (editingEvent) {
      editEvent(newEvent);
    } else {
      addEvent(newEvent);
    }
    onClose();
    dispatch({ type: "RESET" });
  };

  return { state, updateField, onSubmit, dispatch };
};
