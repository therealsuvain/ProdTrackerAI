import { Task } from '../types/task';
import { CalendarEvent } from '../types/calendar';
import { TimerLog } from '../types/timer';
import { Habit } from '../types/habits';

export const dummyTasks: Task[] = [
    {
        id: '1',
        title: 'Complete Project Presentation',
        description: 'Prepare slides for the quarterly review',
        category: 'Work',
        dueDate: new Date(2025, 9, 10),
        priority: 'high',
        completed: false,
        tags: ['presentation', 'quarterly']
    },
    {
        id: '2',
        title: 'Grocery Shopping',
        description: 'Buy vegetables, fruits, and household items',
        category: 'Personal',
        dueDate: new Date(2025, 9, 7),
        priority: 'medium',
        completed: false,
        tags: ['shopping', 'routine']
    },
    {
        id: '3',
        title: 'Gym Session',
        description: 'Cardio and strength training',
        category: 'Health',
        dueDate: new Date(2025, 9, 7),
        priority: 'low',
        completed: true,
        tags: ['fitness', 'health']
    }
];

export const dummyEvents: CalendarEvent[] = [
    {
        id: '1',
        title: 'Team Meeting',
        startTime: new Date(2025, 9, 8, 10, 0),
        endTime: new Date(2025, 9, 8, 11, 0),
        description: 'Weekly sync with the development team',
        recurrence: 'none', 
        notificationId: '0', 
        category: 'none',
        reminder: true
    },
    {
        id: '2',
        title: 'Doctor Appointment',
        startTime: new Date(2025, 9, 9, 15, 30),
        endTime: new Date(2025, 9, 9, 16, 30),
        description: 'Annual checkup',
        reminder: true,
        recurrence: 'none', 
        notificationId: '0', 
        category: 'none',
    },
    {
        id: '3',
        title: 'Birthday Party',
        startTime: new Date(2025, 9, 12, 18, 0),
        endTime: new Date(2025, 9, 12, 22, 0),
        description: "Friend's birthday celebration",
        reminder: false,
        recurrence: 'none', 
        notificationId: '0', 
        category: 'none',
    }
];

export const dummyTimerLogs: TimerLog[] = [
    {
        id: '1',
        activity: 'Coding',
        startTime: new Date(2025, 9, 7, 9, 0),
        endTime: new Date(2025, 9, 7, 10, 30),
        duration: 5400
    },
    {
        id: '2',
        activity: 'Reading',
        startTime: new Date(2025, 9, 7, 14, 0),
        endTime: new Date(2025, 9, 7, 15, 0),
        duration: 3600
    },
    {
        id: '3',
        activity: 'Meditation',
        startTime: new Date(2025, 9, 7, 18, 0),
        endTime: new Date(2025, 9, 7, 18, 15),
        duration: 900
    }
];

export const dummyHabits: Habit[] = [
    {
        id: '1',
        name: 'Morning Exercise',
        frequency: 'daily',
        streak: 5,
        lastCompleted: new Date(2025, 9, 7),
        goal: 30
    },
    {
        id: '2',
        name: 'Read Books',
        frequency: 'daily',
        streak: 12,
        lastCompleted: new Date(2025, 9, 6),
        goal: 21
    },
    {
        id: '3',
        name: 'Weekly Review',
        frequency: 'weekly',
        streak: 3,
        lastCompleted: new Date(2025, 9, 5),
        goal: 52
    }
];