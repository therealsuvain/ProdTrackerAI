import { CalendarEvent } from "@/types/calendar";
import { calculateMarketDates } from "@/utils/event-utils";
import { ExpandableCalendar, AgendaList, CalendarProvider } from 'react-native-calendars';

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
        <CalendarProvider date={new Date().toDateString()}>
        <ExpandableCalendar
        markedDates={markedDates}
        onDayPress={(day)=>onDateSelect(new Date(day.timestamp))}
        theme={{
            selectedDayBackgroundColor: 'blue',
            todayTextColor: 'red',
        }}
        style={{borderRadius:20}}
        />
        
        </CalendarProvider>
    )
}