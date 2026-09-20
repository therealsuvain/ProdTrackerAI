import { useTaskStore } from "@/stores/use-task-store";
import { Task } from "@/types/task";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";
import {
  cancelReminder,
  scheduleReminderTasks,
} from "@/hooks/use-notifications";

/**
 * Single canonical entry point for "user completed/uncompleted a task."
 * Every UI surface (task screen, home, timeline, AI actions, notification
 * actions) must call this — never call useTaskStore.toggleTask directly
 * from a component if the completion should count toward metrics.
 */

export async function addTaskWithEffects(task: Task, actor: 'user' | 'ai' = "user"): Promise<void> {
  if (task.reminder) {
    const notificationId = await scheduleReminderTasks(task);
    task.notificationId = notificationId;
  }
  await useTaskStore.getState().addTask(task);
  metricsEventBus.emit("metric:track", {
    keys: ["tasksAdded"],
    amount: 1,
    actor,
  });
}

export async function editTaskWithEffects(task: Task, actor: 'user' | 'ai' = "user"): Promise<void> {
  const oldTask = useTaskStore.getState().tasksById[task.id];
  if (!oldTask) throw new Error(`Task ${task.id} not found`);

  //Note: Cancel old task's reminder regardless of any case
  if (oldTask.reminder && oldTask.notificationId) {
    await cancelReminder(oldTask.notificationId);
  }

  if (task.reminder) {
    const notificationId = await scheduleReminderTasks(task);
    task.notificationId = notificationId;
  }

  await useTaskStore.getState().editTask(task);
  metricsEventBus.emit("metric:track", {
    keys: ["tasksEdited"],
    amount: 1,
    actor,
  });
}

export async function deleteTaskWithEffects(id: string, actor: 'user' | 'ai' = "user"): Promise<void> {
  const task = useTaskStore.getState().tasksById[id];
  if (!task) throw new Error(`Task ${id} not found`);
  await useTaskStore.getState().removeTask(id);

  if (task.notificationId) {
    cancelReminder(task.notificationId);
  }

  if (task.completed) {
    metricsEventBus.emit("metric:track", { keys: ["tasksDeleted"], amount: 1 });
  } else {
    metricsEventBus.emit("metric:track", {
      keys: ["tasksDeleted", "tasksAbandoned"],
      amount: 1,
      actor,
    });
  }
}

export async function deleteAllTasksWithEffects(actor: 'user' | 'ai' = "user"): Promise<void> {
  const DeletedTasks = Object.values(useTaskStore.getState().tasksById);
  const noOfDeletedTasks = DeletedTasks.length;
  await useTaskStore.getState().removeTasks();
  metricsEventBus.emit("metric:track", { keys: ["tasksDeleted"], amount: noOfDeletedTasks, actor });
  let noOfAbandonedTasks = 0;
  for (const task of DeletedTasks) {
    if (task.completed) continue;
    noOfAbandonedTasks += 1;
  }
  metricsEventBus.emit("metric:track", { keys: ["tasksAbandoned"], amount: noOfAbandonedTasks, actor });

}
export async function toggleTaskWithEffects(id: string, actor: 'user' | 'ai' = "user"): Promise<void> {
  const task = useTaskStore.getState().tasksById[id];
  if (!task) throw new Error(`Task ${id} not found`);

  const wasCompleted = task.completed;

  // Store applies the optimistic update synchronously inside this call,
  // before its internal DB-write await — UI-visible state is already
  // correct by the time this line finishes evaluating, regardless of
  // how long the underlying SQLite write takes.
  await useTaskStore.getState().toggleTask(id);

  metricsEventBus.emit("metric:track", {
    keys: ["tasksCompleted"],
    amount: wasCompleted ? -1 : 1,
    actor,
  });
}

export function setTaskOrderWithEffects(tasks: string[]): void {
  useTaskStore.getState().setTaskOrder(tasks);
}
export function reassignTaskCategoryWithEffects(oldId: string, newId: string): void {
  useTaskStore.getState().reassignTaskCategoryLocal(oldId, newId);
}

export function reassignTaskTagWithEffects(oldId: string, newId: string | null): void {
  useTaskStore.getState().reassignTaskTagLocal(oldId, newId);
}

export function taskCountWithEffects(): Promise<number> {
  return useTaskStore.getState().taskCount();
}

export async function batchMutateTasksWithEffects(tasksToMutate: Task[], newValues: any): Promise<void> {
  await useTaskStore.getState().batchMutateTasks(tasksToMutate, newValues);
}

export async function batchRestoreTasksWithEffects(originalTasks: Task[]): Promise<void> {
  useTaskStore.getState().batchRestoreTasks(originalTasks);
}