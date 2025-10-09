// import { useEffect } from 'react';
// import { useForm, UseFormReturn } from 'react-hook-form';
// import { yupResolver } from '@hookform/resolvers/yup';
// import * as yup from 'yup';
// import { CalendarEvent } from '../types/calendar';
// import { randomUUID } from 'expo-crypto';
// import { scheduleReminder, cancelReminder } from './use-notifications'; // Import from next hook
// import { validateEventTimes } from '@/utils/eventUtils';

// const eventSchema = yup.object().shape({
//   title: yup.string().required('Title is required'),
//   startTime: yup.date().required('Start time is required'),
//   endTime: yup.date().nullable().optional(),
//   description: yup.string().optional(),
//   reminder: yup.boolean().default(false),
//   recurrence: yup.mixed<'none' | 'daily' | 'weekly'>().default('none'),
//   category: yup.string().optional(),
// });

// interface UseEventFormProps {
//   events: CalendarEvent[];
//   setEvents: (events: CalendarEvent[]) => void;
//   editingEvent: CalendarEvent | null;
//   onClose: () => void;
// }

// export const useEventForm = ({ events, setEvents, editingEvent, onClose }: UseEventFormProps): UseFormReturn<CalendarEvent> & { onSubmit: (data: CalendarEvent) => Promise<void> } => {
//   const form = useForm<CalendarEvent>({
//     resolver: yupResolver(eventSchema),
//     defaultValues: {
//       title: '',
//       startTime: new Date(),
//       endTime: undefined,
//       description: '',
//       reminder: false,
//       recurrence: 'none',
//       category: '',
//     },
//   });

//   const { reset, handleSubmit, setError } = form;

//   useEffect(() => {
//     reset(editingEvent ? { ...editingEvent } : form.defaultValues);
//   }, [editingEvent, reset]);

//   const onSubmit = async (data: CalendarEvent) => {
//     if (!validateEventTimes(data.startTime, data.endTime)) {
//       setError('endTime', { message: 'End time must be after start' });
//       return;
//     }
//     const newEvent: CalendarEvent = {
//       id: editingEvent ? editingEvent.id : randomUUID(),
//       ...data,
//     };
//     if (editingEvent && editingEvent.notificationId) {
//       await cancelReminder(editingEvent.notificationId);
//     }
//     if (newEvent.reminder) {
//       const notifId = await scheduleReminder(newEvent);
//       newEvent.notificationId = notifId;
//     }
//     if (editingEvent) {
//       setEvents(events.map(e => e.id === editingEvent.id ? newEvent : e));
//     } else {
//       setEvents([...events, newEvent]);
//     }
//     onClose();
//     reset();
//   };

//   return { ...form, onSubmit: handleSubmit(onSubmit) };
// };