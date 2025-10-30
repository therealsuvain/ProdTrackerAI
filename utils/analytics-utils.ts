import { Task } from "@/types/task";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";

export const getTaskCompletion = (tasks: Task[]): number => {
    const completed = tasks.filter(t => t.completed).length;
    return tasks.length ? (completed / tasks.length) * 100 : 0;
}

export const getTotalTimeTracked = (logs: TimerLog[], period: 'week' | 'month'): number => {
    const now= new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (period === 'week'? 7: 30))
    return logs.filter(log => log.startTime >=start).reduce ((sum , log)=> sum + (log.duration || 0),0)/60;
}

export const getHabitProgress = ( habits: Habit[]) : { title : string; progress:number}[] => {
    return habits.map( h=> ({
        title: h.title,
        progress: h.goal? (h.streak/h.goal)*100 : h.streak,
    }))
}
