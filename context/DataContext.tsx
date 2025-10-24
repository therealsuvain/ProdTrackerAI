import React, {createContext, useState, useEffect, ReactNode} from 'react';
import { Task } from '../types/task';
import { CalendarEvent } from '../types/calendar';
import { TimerLog } from '../types/timer';
import { Habit } from '../types/habits';
import { loadTasks, saveTasks, loadEvents, saveEvents, loadTimerLogs, saveTimerLogs, loadHabits, saveHabits } from '../utils/storrage';
import { dummyTasks, dummyEvents, dummyTimerLogs, dummyHabits } from '../data/dummyData';

interface DataContextType{
    tasks: Task[];
    setTasks : (tasks:Task[])=>void;
    events: CalendarEvent[];
    setEvents: (events: CalendarEvent[])=> void;
    timerLogs: TimerLog[];
    setTimerLogs: (timerLogs: TimerLog[])=> void;
    habits: Habit[];
    setHabits:(habits: Habit[])=>void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

// Feature flag for using dummy data - can be moved to environment variables or config
const USE_DUMMY_DATA = true;

export default function  DataProvider({children}: {children: ReactNode}){
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);

    useEffect(()=>{
        const loadData= async()=>{
           
                let loadedTasks = await loadTasks();
                let loadedEvents = await loadEvents();
                let loadedLogs = await loadTimerLogs();
                let loadedHabits = await loadHabits();
            
                // Initialize with dummy data if enabled and no data exists
                if (USE_DUMMY_DATA) {
                    if (loadedTasks.length === 0) loadedTasks = dummyTasks;
                    if (loadedEvents.length === 0) loadedEvents = dummyEvents;
                    if (loadedLogs.length === 0) loadedLogs = dummyTimerLogs;
                    if (loadedHabits.length === 0) loadedHabits = dummyHabits;
                }
            
                setTasks(loadedTasks);
                setEvents(loadedEvents);
                setTimerLogs(loadedLogs);
                setHabits(loadedHabits);
            
        }
        loadData();
    },[])

    useEffect(()=>{saveTasks(tasks)}, [tasks]);
    useEffect(()=>{saveEvents(events)}, [events]);
    useEffect(()=>{saveTimerLogs(timerLogs)}, [timerLogs]);
    useEffect(()=>{saveHabits(habits)}, [habits]);

    return(
        <DataContext.Provider value={{
            tasks,
            setTasks,
            events,
            setEvents,
            timerLogs,
            setTimerLogs,
            habits,
            setHabits,
        }}>
            {children}
        </DataContext.Provider>
    )
}