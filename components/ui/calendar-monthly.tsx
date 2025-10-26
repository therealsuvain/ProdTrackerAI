import { CalendarEvent } from "@/types/calendar";
import { calculateMarketDates } from "@/utils/event-utils";
import { Calendar, AgendaList, CalendarProvider } from 'react-native-calendars';

interface CalendarMonthlyProps {
    events : CalendarEvent[];
    onDateSelect : (date: Date)=>void;
    selectedDate: Date;
}

export default function CalendarMonthly({events, onDateSelect, selectedDate}: CalendarMonthlyProps){
    const markedDates = calculateMarketDates(events);
    const selectedStr = selectedDate.toISOString().split('T')[0];
    markedDates[selectedStr]= { ...markedDates[selectedStr], marked: true, dotColor: "#F44336" };

    return (
        <Calendar
        markedDates={markedDates}
        onDayPress={(day)=>onDateSelect(new Date(day.timestamp))}
        theme={{
            selectedDayBackgroundColor: "#8f251dff",
            todayTextColor: "#8f251dff",
        }}
        style={{borderRadius:20}}
        />
    )
}