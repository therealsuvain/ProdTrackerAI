// import { CalendarEvent } from '@/types/calendar';
// import { useForm, UseFormReturn } from 'react-hook-form';
// import * as yup from 'yup';
// import { yupResolver } from '@hookform/resolvers/yup';
// import { useEffect } from 'react';
// import { validateEventTimes } from '@/utils/eventUtils';
// import { randomUUID } from 'expo-crypto';
// import { cancelReminder, scheduleReminder } from './use-notifications';

// const eventSchema = yup.object().shape({
//     title: yup.string().required('Title is required'),
//     startTime: yup.date().required('Start time is required'),
//     endTime: yup.date().required(),
//     description:yup.string().required(),
//     reminder: yup.boolean().default(false),
//     recurrence: yup.string().default('none'),
//     notificationId: yup.string().required(),
//     category: yup.string().required(),
// })

// type EventFormData = yup.InferType<typeof eventSchema>;

// interface UseEventFormProps{
// events : CalendarEvent[];
// setEvents: (events:CalendarEvent[])=> void;
// editingEvent: CalendarEvent | null;
// onClose: ()=>void;
// }
// // type NewEventData1 = Omit<CalendarEvent,'id'>;
// export const useEventForm = ({ events, setEvents, editingEvent, onClose }: 
//     UseEventFormProps): UseFormReturn<EventFormData> & { onSubmit: (data: EventFormData) => Promise<void> } => {

//         const  defaultValues={
//             title: '',
//             startTime: new Date(),
//             endTime: undefined,
//             description:'',
//             reminder: false,
//             recurrence: 'none',
//             category: '',
//         }
//     const form= useForm<EventFormData>({
//         resolver: yupResolver(eventSchema),
//         defaultValues:{...defaultValues}
//     })

//     const {reset, handleSubmit, setError}= form

//     useEffect(()=>{
//         reset(editingEvent? {...editingEvent}: {...defaultValues} );
//     },[editingEvent, reset]);
    
//     //type NewEventData = Omit<CalendarEvent,'id'>;

//     const onSubmit = async (data: EventFormData) =>{
//         if(!validateEventTimes(data.startTime, data.endTime)){
//             setError('endTime',{message: ' End Time must be after start'});
//             return;
//         }
//         const newEvent : CalendarEvent = {
//             id : editingEvent? editingEvent.id : randomUUID(),
//             ...data,
//         };

//         if(editingEvent && editingEvent.notificationId){
//             await cancelReminder(editingEvent.notificationId);
//         }

//         if (newEvent.reminder){
//             const notifId= await scheduleReminder(newEvent);
//             newEvent.notificationId=notifId
//         }

//         if(editingEvent){
//             setEvents(events.map(e=>e.id === editingEvent.id? newEvent : e));
//         } else {
//             setEvents([...events, newEvent]);
//         }
//         onClose();
//         reset();
//     };

//     return {...form, onSubmit : handleSubmit(onSubmit)};
// }
