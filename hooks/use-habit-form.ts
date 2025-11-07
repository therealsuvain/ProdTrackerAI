import { Habit } from '@/types/habits';
import { useReducer, useEffect } from 'react';
import { randomUUID } from 'expo-crypto';
import { cancelReminder, scheduleReminderHabits } from './use-notifications';

type Frequency = 'daily' | 'weekly';

type FormState = Omit<Habit, 'id' | 'notificationId' | 'streak' | 'lastCompleted'> & {
  frequency: Frequency;
  goal?: number | string;
  errors: Partial<Record<'title' | 'frequency' | 'goal' | 'reminder' | 'reminderDate', string>>;
};

type FormAction =
  | { type: 'UPDATE_FIELD'; payload: { field: keyof FormState; value: any } }
  | { type: 'SET_ERROR'; payload: { field: keyof FormState; message: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET'; payload?: Partial<FormState> };

const initialState: FormState = {
  title: '',
  frequency: 'daily',
  reminder: false,
  reminderDate: undefined,
  goal: undefined,
  errors: {},
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
        errors: { ...state.errors, [action.payload.field]: undefined },
      };
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.payload.field]: action.payload.message } };
    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };
    case 'RESET':
      return { ...initialState, ...action.payload };
    default:
      return state;
  }
};

interface UseHabitFormProps {
  habits: Habit[];
  setHabits: (habits: Habit[]) => void;
  editingHabit: Habit | null;
  onClose: () => void;
}

export const useHabitForm = ({ habits, setHabits, editingHabit, onClose }: UseHabitFormProps) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  useEffect(() => {
    if (editingHabit) {
      dispatch({
        type: 'RESET',
        payload: {
          title: editingHabit.title,
          frequency: (editingHabit.frequency as Frequency) || 'daily',
          reminder: editingHabit.reminder,
          reminderDate: editingHabit.reminderDate,
          goal: editingHabit.goal,
        },
      });
    } else {
      dispatch({ type: 'RESET' });
    }
  }, [editingHabit]);

  const updateField = (field: keyof FormState, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { field, value } });
  };

  const onSubmit = async () => {
    dispatch({ type: 'CLEAR_ERRORS' });
    if (!state.title) {
      dispatch({ type: 'SET_ERROR', payload: { field: 'title' as keyof FormState, message: 'Title is required' } });
      return;
    }

    let newHabit: Habit = {
      id: editingHabit ? editingHabit.id : randomUUID(),
      title: state.title,
      frequency: state.frequency as unknown as string,
      streak: editingHabit ? editingHabit.streak : 0,
      lastCompleted: editingHabit ? editingHabit.lastCompleted : undefined,
      reminder: state.reminder,
      reminderDate: state.reminderDate,
      goal: state.goal ? (typeof state.goal === 'string' ? parseInt(state.goal) : state.goal) : undefined,
      notificationId: editingHabit ? editingHabit.notificationId : undefined,
    };

    if (editingHabit && editingHabit.notificationId) {
      await cancelReminder(editingHabit.notificationId);
    }

    if (newHabit.reminder) {
      const notifId = await scheduleReminderHabits(newHabit);
      newHabit.notificationId = notifId;
    }

    if (editingHabit) {
      setHabits(habits.map((h) => (h.id === editingHabit.id ? newHabit : h)));
    } else {
      setHabits([...habits, newHabit]);
    }

    onClose();
    dispatch({ type: 'RESET' });
  };

  return { state, updateField, onSubmit, dispatch };
};
