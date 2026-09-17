import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";
import storageMMKV from "@/utils/Storage-Utils/mmkv-instance";
import { STORAGE_KEYS } from "@/utils/Storage-Utils/storage-keys";
import { getTodayISO } from "@/utils/common-utils";
import { Task } from "@/types/task";



function maintenanceKeyLastRun(userId: string | null): string {
  return `${STORAGE_KEYS.TASK_MAINTENANCE_LAST_RUN}:${userId ?? "anonymous"}`;
}

function maintenanceKeyMissedTasks(userId: string | null): string {
  return `${STORAGE_KEYS.MISSED_TASK_IDS}:${userId ?? "anonymous"}`;
}

export async function runTaskMaintenanceOncePerDay(
  tasks: Record<string, Task>,
  userId: string | null,
): Promise<void> {
  const today = getTodayISO();
  const key = maintenanceKeyLastRun(userId);
  const lastRun = storageMMKV.getString(key);

  if (lastRun === today) return;

  await runTasksMissedMaintenance(tasks, userId);
  storageMMKV.set(key, today); // only marked done AFTER success
}


async function runTasksMissedMaintenance(
  tasks: Record<string, Task>,
  userId: string | null,
): Promise<void> {
  try {
    const key = maintenanceKeyMissedTasks(userId);
    const rawTrackedIds = storageMMKV.getString(key);
    const trackedMissedIds = new Set<string>(
      rawTrackedIds ? JSON.parse(rawTrackedIds) : [],
    );

    const now = Date.now();

    // 1. Remove stale ids automatically:
    // - task no longer exists
    // - task has no dueDate
    // - task is completed
    // - task is no longer overdue (e.g. dueDate edited into future)
    for (const trackedId of [...trackedMissedIds]) {
      const task = tasks[trackedId];

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

    for (const task of Object.values(tasks)) {
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
      metricsEventBus.emit("metric:track", { keys:["tasksMissed"], amount:newlyMissedCount, actor:"user" });
    }

    // 4. Persist cleaned + updated tracking set
    storageMMKV.set(
      key,
      JSON.stringify([...trackedMissedIds]),
    );

  } catch (err) {
    console.error("[tasksMissed] maintenance failed:", err);
  }
}