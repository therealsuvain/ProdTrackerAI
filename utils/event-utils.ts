import { CalendarEvent } from "@/types/calendar";

//Get events for a specific date
export const getEventsForDate = (events : CalendarEvent[], date: Date) :  CalendarEvent[] =>{
    const filtered: CalendarEvent[]=[];
    events.forEach(event =>{
        const eventDate= new Date(event.startTime);
        if(
            eventDate.toDateString() === date.toDateString() ||
            (event.recurrence === 'daily') ||
            (event.recurrence === 'weekly' && eventDate.getDay() === date.getDay())
        ){
            filtered.push(event);
        }
    })
    return sortEventsByTime(filtered);
}

export const sortEventsByTime = (filtered: CalendarEvent[]): CalendarEvent[] => {
   return [...filtered].sort((a,b) => a.startTime.getTime() - b.startTime.getTime());
}

export const calculateMarketDates= (events: CalendarEvent[]) : Record<string,{marked:boolean;dotColor:string}> =>{
    const marked : Record<string, {marked:boolean;dotColor:string}>={}; 
    events.forEach(event => {
        const dateStr = event.startTime.toISOString().split('T')[0];
        marked[dateStr] ={ marked : true, dotColor: 'blue'};
        if (event.recurrence === 'daily' || event.recurrence === 'weekly'){
            let nextDate = new Date(event.startTime);
            for(let i=0; i< 365; i++){
                nextDate=new Date(nextDate);
                nextDate.setDate(nextDate.getDate()+ (event.recurrence === 'daily'?1:7));
                const nextStr= nextDate.toISOString().split('T')[0];
                marked[nextStr] = {marked : true, dotColor: 'blue'}

            }
        }
 });
 return marked;
}

export const validateEventTimes = (start : Date, end? : Date): boolean =>{
    return !end || start < end;
}
