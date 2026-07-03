import { Task } from "@/types/task";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";
import AsyncStorage from "@react-native-async-storage/async-storage";


const LAST_MISSED_CHECK_KEY = "lastTasksMissedCheckDate";
const MISSED_TASK_IDS_KEY = "missedTaskIds";


export const getTaskCompletion = (tasks: Task[]): number => {
    const completed = tasks.filter(t => t.completed).length;
    return tasks.length ? (completed / tasks.length) * 100 : 0;
}

export const getTotalTimeTracked = (logs: TimerLog[], period: 'week' | 'month'): number => {
    const now= new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (period === 'week'? 7: 30))
    return logs.filter(log => log.startTime >=start.toISOString()).reduce ((sum , log)=> sum + (log.duration || 0),0)/60;
}

export const getHabitProgress = ( habits: Habit[]) : { title : string; progress:number}[] => {
    return habits.map( h=> ({
        title: h.title,
        progress: h.goal? (h.streak/h.goal)*100 : h.streak,
    }))
}


export async function runTasksMissedMaintenanceOnActive(
  tasks: Task[],
  trackMetric: any,
): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const lastAuditDate = await AsyncStorage.getItem(LAST_MISSED_CHECK_KEY);
    if (lastAuditDate === today) return;

    const rawTrackedIds = await AsyncStorage.getItem(MISSED_TASK_IDS_KEY);
    const trackedMissedIds = new Set<string>(
      rawTrackedIds ? JSON.parse(rawTrackedIds) : [],
    );

    const now = Date.now();
    const currentTaskIds = new Set(tasks.map((t) => t.id));

    // 1. Remove stale ids automatically:
    // - task no longer exists
    // - task has no dueDate
    // - task is completed
    // - task is no longer overdue (e.g. dueDate edited into future)
    for (const trackedId of [...trackedMissedIds]) {
      const task = tasks.find((t) => t.id === trackedId);

      if (!task) {
        trackedMissedIds.delete(trackedId);
        continue;
      }

      if (!task.dueDate || task.completed) {
        trackedMissedIds.delete(trackedId);
        continue;
      }

      const due = new Date(task.dueDate);
      due.setHours(23, 59, 59, 999);
      const dueTs = due.getTime();
      if (Number.isNaN(dueTs) || dueTs >= now) {
        trackedMissedIds.delete(trackedId);
      }
    }

    // 2. Find newly missed tasks
    let newlyMissedCount = 0;

    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (task.completed) continue;
      if (trackedMissedIds.has(task.id)) continue;

      const dueTs = new Date(task.dueDate).getTime();
      if (Number.isNaN(dueTs)) continue;

      if (dueTs < now) {
        trackedMissedIds.add(task.id);
        newlyMissedCount += 1;
      }
    }

    // 3. Increment metric only for newly missed tasks
    if (newlyMissedCount > 0) {
      trackMetric(["tasksMissed"], newlyMissedCount);
    }

    // 4. Persist cleaned + updated tracking set
    await AsyncStorage.setItem(
      MISSED_TASK_IDS_KEY,
      JSON.stringify([...trackedMissedIds]),
    );

    // 5. Mark audit done for today
    await AsyncStorage.setItem(LAST_MISSED_CHECK_KEY, today);
  } catch (err) {
    console.error("[tasksMissed] maintenance failed:", err);
  }
}