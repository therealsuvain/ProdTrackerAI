import { CalendarEvent } from "@/types/calendar";
import { useReducer } from "react";
import { useEffect } from "react";
import { validateEventTimes } from "@/utils/event-utils";
import { randomUUID } from "expo-crypto";
import { cancelReminder, scheduleReminderEvents } from "./use-notifications";
import {generateEmbedding} from '@/utils/embedding-engine'

type FormState = Omit<CalendarEvent, "id" | "notificationId"> & {
  errors: Partial<
    Record<keyof Omit<CalendarEvent, "id" | "notificationId">, string>
  >;
};

type FormAction =
  | { type: "UPDATE_FIELD"; payload: { field: keyof FormState; value: any } }
  | { type: "SET_ERROR"; payload: { field: keyof FormState; message: string } }
  | { type: "CLEAR_ERRORS" }
  | { type: "RESET"; payload?: Partial<FormState> };

const initialState: FormState = {
  title: "",
  startDate: new Date(),
  endDate: new Date(),
  startTime: new Date(),
  endTime: new Date(),
  description: "",
  reminder: false,
  recurrence: "none",
  category: "",
  deletedOccurrences: [],
  errors: {},
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
  events: CalendarEvent[];
  setEvents: (events: CalendarEvent[]) => void;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
}

const cancelAllRemniders = async (notifications: { date: string; id: string }[]) => {
  notifications?.forEach((n) => cancelReminder(n.id));
};

const isTimeEdited = (editingEvent: CalendarEvent|null, newEvent: CalendarEvent) => {
  if (!editingEvent) return false;
  if(!editingEvent.reminder) return false;
  return (
    editingEvent.startDate.toDateString() !==
      newEvent.startDate.toDateString() ||
    editingEvent.endDate.toDateString() !== newEvent.endDate.toDateString() ||
    editingEvent.startTime.toTimeString() !==
      newEvent.startTime.toTimeString() ||
    editingEvent.endTime.toTimeString() !== newEvent.endTime.toTimeString() ||
    editingEvent.recurrence !== newEvent.recurrence
  );
};

export const useEventForm = ({
  events,
  setEvents,
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
          embedding :editingEvent.embedding
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
    if (!validateEventTimes(state.startTime, state.endTime)) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "endTime", message: "End time must be after start" },
      });
      hasError = true;
    }

    if (hasError) return;

    let newEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : randomUUID(),
      notificationIds: undefined,
      ...state,
      embedding: state.embedding || await generateEmbedding(state.title,false)
    };


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
    if (newEvent.reminder && !editingEvent?.reminder) {
      console.log("new reminders")
      const notifIds = await scheduleReminderEvents(newEvent);
      newEvent.notificationIds = notifIds;
    }

    if(isTimeEdited(editingEvent,newEvent) && editingEvent?.notificationIds){
      console.log("old cancelled")
      await cancelAllRemniders(editingEvent.notificationIds)
      const notifIds = await scheduleReminderEvents(newEvent);
      newEvent.notificationIds = notifIds;
    }
    console.log("new", newEvent);
    console.log("edit", editingEvent);
    if (editingEvent) {
      setEvents(events.map((e) => (e.id === editingEvent.id ? newEvent : e)));
    } else {
      setEvents([...events, newEvent]);
    }
    onClose();
    dispatch({ type: "RESET" });
  };

  return { state, updateField, onSubmit, dispatch };
};
