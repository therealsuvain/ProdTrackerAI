import { Habit } from "@/types/habits";
import { useReducer, useEffect } from "react";
import { randomUUID } from "expo-crypto";
import { cancelReminder, scheduleReminderHabits } from "./use-notifications";
import {generateEmbedding} from '@/utils/embedding-engine'

type Frequency = "daily" | "weekly";

type FormState = Omit<
  Habit,
  | "id"
  | "notificationId"
  | "streak"
  | "longestStreak"
  | "history"
> & {
  frequency: Frequency;
  targetDays: number[];
  errors: Partial<
    Record<"title" | "frequency" | "goal" | "reminder" | "reminderDate", string>
  >;
};

type FormAction =
  | { type: "UPDATE_FIELD"; payload: { field: keyof FormState; value: any } }
  | { type: "SET_ERROR"; payload: { field: keyof FormState; message: string } }
  | { type: "CLEAR_ERRORS" }
  | { type: "RESET"; payload?: Partial<FormState> };

const initialState: FormState = {
  title: "",
  frequency: "daily",
  reminder: false,
  reminderDate: undefined,
  streakFreezes:5,
  goal: 0,
  goalCompletions: [],
  targetDays: [],
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
        errors: { ...state.errors, [action.payload.field]: undefined },
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

interface UseHabitFormProps {
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  editingHabit: Habit | null;
  onClose: () => void;
}

export const useHabitForm = ({

  addHabit,
  editHabit,
  editingHabit,
  onClose,
}: UseHabitFormProps) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  useEffect(() => {
    if (editingHabit) {
      dispatch({
        type: "RESET",
        payload: {
          title: editingHabit.title,
          frequency: (editingHabit.frequency as Frequency) || "daily",
          reminder: editingHabit.reminder,
          reminderDate: editingHabit.reminderDate,
          goal: editingHabit.goal,
          createdAt: editingHabit.createdAt,
          updatedAt: editingHabit.updatedAt,
          embedding : editingHabit.embedding
        },
      });
    } else {
      dispatch({ type: "RESET" });
    }
  }, [editingHabit]);

  const updateField = (field: keyof FormState, value: any) => {
    dispatch({ type: "UPDATE_FIELD", payload: { field, value } });
  };

  const onSubmit = async () => {
    dispatch({ type: "CLEAR_ERRORS" });
    let hasError = false;
    if (!state.title) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "title" as keyof FormState,
          message: "Title is required",
        },
      });
      hasError = true;
      return;
    }

    if (state.reminder && !state.reminderDate) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "reminderDate",
          message: "For reminders, time is required",
        },
      });
      hasError = true;
      return;
    }

    if (!state.goal) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "goal" as keyof FormState,
          message: "Goal is required",
        },
      });
      hasError = true;
      return;
    }

    if (state.goal <= 0) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "goal" as keyof FormState,
          message: "A minimum of 1 goal is required",
        },
      });
      hasError = true;
      return;
    }

    

    if (hasError) return;
    let newHabit: Habit = {
      id: editingHabit ? editingHabit.id : randomUUID(),
      title: state.title,
      frequency: state.frequency,
      streak: editingHabit ? editingHabit.streak : 0,
      history: editingHabit ? editingHabit.history : [],
      targetDays: state.targetDays,
      streakFreezes: state.streakFreezes,
      longestStreak: editingHabit ? editingHabit.streak : 0,
      reminder: state.reminder,
      reminderDate: state.reminderDate,
      goal:  typeof state.goal === "string"
          ? parseInt(state.goal)
          : state.goal,
      goalCompletions: state.goalCompletions || [],
      createdAt: editingHabit ? editingHabit.createdAt : state.createdAt,
      updatedAt: state.updatedAt,
      notificationId: editingHabit ? editingHabit.notificationId : undefined,
      embedding: state.embedding || await generateEmbedding(state.title,false)
    };

    if (editingHabit && editingHabit.notificationId) {
      console.log("HABIT FORM NOTIF: old cancelled");
      await cancelReminder(editingHabit.notificationId);
    }

    if (newHabit.reminder) {
      console.log("HABIT FORM NOTIF: new scheduled");
      const notifId = await scheduleReminderHabits(newHabit);
      newHabit.notificationId = notifId;
    }

    if (editingHabit) {
      await editHabit(newHabit);
    } else {
      await addHabit(newHabit);
    }

    onClose();
    dispatch({ type: "RESET" });
  };

  return { state, updateField, onSubmit, dispatch };
};
