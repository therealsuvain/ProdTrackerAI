import { Task } from "@/types/task";
import { CalendarEvent } from "@/types/calendar";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";

export type SearchResult = {
    type: 'task' | 'event' | 'habit' | 'log';
    item: Task | CalendarEvent | Habit | TimerLog;
}

export const globalSearch = (
    query: string,
    tasks: Task[],
    events: CalendarEvent[],
    habits: Habit[],
    logs: TimerLog[],
) : SearchResult[] =>{
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    tasks.forEach( task => {
        if(task.title.toLowerCase().includes(lowerQuery)|| (task.description?.toLowerCase().includes(lowerQuery))){
            results.push({type:'task', item:task})
        }
    })

    events.forEach( event => {
        if(event.title.toLowerCase().includes(lowerQuery)|| (event.description?.toLowerCase().includes(lowerQuery))){
            results.push({type:'event', item:event})
        }
    })

    habits.forEach( habit => {
        if(habit.title.toLowerCase().includes(lowerQuery)){
            results.push({type:'habit', item:habit})
        }
    })

    logs.forEach( log => {
        if(log.title.toLowerCase().includes(lowerQuery)){
            results.push({type:'log', item:log})
        }
    })

    return results;
}

