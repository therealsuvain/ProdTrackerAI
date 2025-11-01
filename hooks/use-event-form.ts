import { CalendarEvent } from '@/types/calendar';
import { useReducer } from 'react';
import { useEffect } from 'react';
import { validateEventTimes } from '@/utils/event-utils';
import { randomUUID } from 'expo-crypto';
import { cancelReminder, scheduleReminder } from './use-notifications';

type FormState = Omit<CalendarEvent, 'id' | 'notificationId'> & {
  errors: Partial<Record<keyof Omit<CalendarEvent, 'id' | 'notificationId'>, string>>;
};

type FormAction =
  | { type: 'UPDATE_FIELD'; payload: { field: keyof FormState; value: any } }
  | { type: 'SET_ERROR'; payload: { field: keyof FormState; message: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET'; payload?: Partial<FormState> };

const initialState: FormState = {
  title: '',
  startTime: new Date(),
  endTime: new Date(),
  description: '',
  reminder: false,
  recurrence: 'none',
  category: '',
  errors: {},
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
        errors: { ...state.errors, [action.payload.field]: undefined }, // Clear error on change
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.field]: action.payload.message },
      };
    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };
    case 'RESET':
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

export const useEventForm = ({ events, setEvents, editingEvent, onClose }: UseEventFormProps) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  useEffect(() => {
    if (editingEvent) {
      dispatch({
        type: 'RESET',
        payload: {
          title: editingEvent.title,
          startTime: editingEvent.startTime,
          endTime: editingEvent.endTime,
          description: editingEvent.description,
          reminder: editingEvent.reminder,
          recurrence: editingEvent.recurrence,
          category: editingEvent.category,
        },
      });
    } else {
      dispatch({ type: 'RESET' });
    }
  }, [editingEvent]);

  const updateField = (field: keyof FormState, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { field, value } });
  };

  const onSubmit = async () => {
    dispatch({ type: 'CLEAR_ERRORS' });
    let hasError = false;

    if (!state.title) {
      dispatch({ type: 'SET_ERROR', payload: { field: 'title', message: 'Title is required' } });
      hasError = true;
    }
    if (!state.startTime) {
      dispatch({ type: 'SET_ERROR', payload: { field: 'startTime', message: 'Start time is required' } });
      hasError = true;
    }
    if (!validateEventTimes(state.startTime, state.endTime)) {
      dispatch({ type: 'SET_ERROR', payload: { field: 'endTime', message: 'End time must be after start' } });
      hasError = true;
    }

    if (hasError) return;

    let newEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : randomUUID(),
      notificationId: undefined,
      ...state,
    };

    if (editingEvent && editingEvent.notificationId) {
      await cancelReminder(editingEvent.notificationId);
    }
    if (newEvent.reminder) {
      const notifId = await scheduleReminder(newEvent);
      newEvent.notificationId = notifId;
      console.log(notifId)
    }

    if (editingEvent) {
      setEvents(events.map(e => e.id === editingEvent.id ? newEvent : e));
    } else {
      setEvents([...events, newEvent]);
    }
    onClose();
    dispatch({ type: 'RESET' });
  };

  return { state, updateField, onSubmit, dispatch };
};