import { AIHandler } from "@/types/ai-handler";
import { createTask } from "../model-factory-utils";
import { scheduleReminderTasks } from "../../hooks/use-notifications";
import { generateEmbedding } from "@/utils/embedding-engine";

export const AddTaskHandler: AIHandler = {
  execute: async (params, context) => {
    // 1. Use your existing factory to create a consistent Task object
    const newTask = await createTask({
      title: params.title || "New Task",
      priority: params.priority || "medium",
      dueDate: params.dueDate,
      category: params.category || "General",
    });

    // 2. Handle notifications if a reminder was parsed
    if (newTask.reminder) {
      try {
        newTask.notificationId = await scheduleReminderTasks(newTask);
      } catch (error) {
        console.warn("Failed to schedule notification:", error);
      }
    }

    // 3. Update the global state via the context
    context.setTasks((prev) => [...prev, newTask]);

    console.log(`AI Action: Added task "${newTask.title}"`);
  }
};

export const EditTaskHandler: AIHandler = {
  execute: async (params, context) => {
    if (params.title) {
      const embeddingVector = await generateEmbedding(params.title, false);
      params.embedding = embeddingVector;
    }
    const oldTask = context.tasks.find((t) => t.id.slice(0, 8) === params.id);
    const updatedTask = await createTask({ ...oldTask, ...params, id: oldTask?.id })
    context.setTasks((prev) =>
      prev.map((t) => (t.id.slice(0, 8) === params.id ? updatedTask : t))
    );
  }
};

export const DeleteTaskHandler: AIHandler = {
  execute: async (params, context) => {
    context.setTasks((prev) => prev.filter((t) => t.id.slice(0, 8) !== params.id));
  }
};

export const CompleteTaskHandler: AIHandler = {
  execute: async (params, context) => {
    context.setTasks((prev) =>
      prev.map((t) => (t.id.slice(0, 8) === params.id ? { ...t, completed: true } : t))
    );
  }
};

export const QueryTasksHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { status = "all", priority = "all", timeRange = "all", sortBy = "newest_first", specificTaskId } = args;

    if (specificTaskId) {
      const targetTask = context.tasks.find((t: any) => t.id.slice(0, 8) === specificTaskId);
      if (!targetTask) return { error: "Task not found in database." };

      return {
        id: targetTask.id,
        title: targetTask.title,
        status: targetTask.completed ? "completed" : "pending",
        priority: targetTask.priority,
        dueDate: targetTask.dueDate || "None",
        notes: targetTask.notes || "No notes provided."
      };
    }

    let filtered = [...context.tasks];
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));

    // 1. Filter by Status
    if (status === "pending") {
      filtered = filtered.filter(t => !t.completed);
    } else if (status === "completed") {
      filtered = filtered.filter(t => t.completed);
    } else if (status === "overdue") {
      filtered = filtered.filter(t => !t.completed && new Date(t.dueDate) < startOfToday);
    }

    // 2. Filter by Priority
    if (priority !== "all") {
      filtered = filtered.filter(t => t.priority === priority);
    }

    // 3. Filter by Time Range (Relative Logic)
    if (timeRange !== "all") {
      filtered = filtered.filter(t => {
        const taskDate = new Date(t.dueDate);
        if (timeRange === "today") {
          return taskDate >= startOfToday && taskDate <= endOfToday;
        }
        if (timeRange === "yesterday") {
          const yesterday = new Date(startOfToday);
          yesterday.setDate(yesterday.getDate() - 1);
          return taskDate >= yesterday && taskDate < startOfToday;
        }
        if (timeRange === "this_week") {
          const endOfWeek = new Date(startOfToday);
          endOfWeek.setDate(endOfWeek.getDate() + 7);
          return taskDate >= startOfToday && taskDate <= endOfWeek;
        }
        if (timeRange === "last_week") {
          const endOfWeek = new Date(startOfToday);
          endOfWeek.setDate(endOfWeek.getDate() - 7);
          return taskDate >= startOfToday && taskDate <= endOfWeek;
        }

        return true;
      });
    }

    // 4. Sort Logic
    filtered.sort((a, b) => {
      if (sortBy === "oldest_first") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (sortBy === "priority_desc") {
        const pMap: any = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      }
      if (sortBy === 'priority_asec') {
        const pMap: any = { high: 1, medium: 2, low: 3 };
        return pMap[b.priority] - pMap[a.priority];
      }
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });

    // 5. Return Summary (ID, Title, Status, DueDate)
    return {
      results: filtered.map(t => ({
        id: t.id.slice(0, 8),
        title: t.title,
        status: t.completed ? "completed" : new Date(t.dueDate) < startOfToday ? "overdue" : "pending",
        due: t.dueDate,
        priority: t.priority
      })),
      count: filtered.length
    };
  }
};