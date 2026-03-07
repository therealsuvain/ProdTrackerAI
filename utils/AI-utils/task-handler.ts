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
      const embeddingVector = await generateEmbedding(params.title,false);
      params.embedding = embeddingVector;
    }
    const oldTask = context.tasks.find((t) => t.id.slice(0,8) === params.id);
    const updatedTask = await createTask({...oldTask, ...params, id: oldTask?.id})
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