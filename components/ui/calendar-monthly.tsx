import { CalendarEvent } from "@/types/calendar";
import { calculateMarketDates } from "@/utils/event-utils";
import { Calendar } from 'react-native-calendars';

interface CalendarMonthlyProps {
    events : CalendarEvent[];
    onDateSelect : (date: Date)=>void;
    selectedDate: Date;
}

export default function CalendarMonthly({events, onDateSelect, selectedDate}: CalendarMonthlyProps){
    const markedDates = calculateMarketDates(events);
    const selectedStr = selectedDate.toISOString().split('T')[0];
    markedDates[selectedStr]= { ...markedDates[selectedStr], marked: true, dotColor: 'blue' };

    return (
        <Calendar
        markedDates={markedDates}
        onDayPress={(day)=>onDateSelect(new Date(day.timestamp))}
        theme={{
            selectedDayBackgroundColor: 'blue',
            todayTextColor: 'red',
        }}
        />
    )
}