import { AIHandler } from "@/types/ai-handler";
import { cancelReminder, scheduleReminderTasks } from "@/hooks/use-notifications";
import { createTask } from "../../model-factory-utils";
import { getTimeRangeHelper } from "./additional-handlers";
import { resolveIdsFromNames } from "./tags-and-categories-handlers";
import { AIActionMemory } from "./ai-action-undo-handlers";
import { fastCosineSimilarity, generateEmbedding } from "@/utils/embedding-engine";
import { Task } from "@/types/task";


// TODOX : If task is marked complete then notification is cancelled in the AI handler, but not in the task item logic, 
// also if task is then marked incomplete, then a new notificaiton is not scheduled, R&D how it should be ideally

//TODO CAtch high demand errors nad return a suitable response, catch any other possibel errors too
// TODOX task due date, event startdate and end date are just in (YYYY-MM-DD) format, convert to ISO 8601 format
export const AddTaskHandler: AIHandler = {
  execute: async (params, context) => {
    // 1. Use your existing factory to create a consistent Task object
    const newTask = await createTask(params);

    // 2. Handle notifications if a reminder was parsed
    if (newTask.reminder) {
      try {
        newTask.notificationId = await scheduleReminderTasks(newTask);
      } catch (error) {
        console.warn("Failed to schedule notification:", error);
        return { status: "partial_success", reason: "Failed to schedule notification", task: newTask };
      }
    }

    // 3. Update the global state via the context
    //context.setTasks((prev) => [...prev, newTask]);
    AIActionMemory.push({ type: "DELETE_TASK", payload: { task: newTask }, timestamp: Date.now() });
    await context.addTask(newTask);
    context.trackMetric(["tasksAdded"], 1);
    console.log(`AI Action: Added task "${newTask.title}"`);
    const { id, embedding, ...rest } = newTask;
    return { status: "success", task: { id: id.slice(0, 8), ...rest } }
  }
};

export const EditTaskHandler: AIHandler = {
  execute: async (params, context) => {
    const oldTask = context.tasks.find((t) => t.id.slice(0, 8) === params.id.slice(0, 8));
    if (!oldTask) {
      throw new Error("Task not found");
    }
    let currentTags = Array.isArray(oldTask.tags) ? [...oldTask.tags] : [];

    if (params.addTagIds && Array.isArray(params.addTagIds)) {
      currentTags = [...new Set([...currentTags, ...params.addTagIds])];
    }

    if (params.removeTagIds && Array.isArray(params.removeTagIds)) {
      currentTags = currentTags.filter(id => !params.removeTagIds.includes(id));
    }
    const updatedTask = await createTask({ ...oldTask, ...params, tags: currentTags, id: oldTask.id })
    if (updatedTask.reminder) {
      try {
        if (updatedTask.notificationId) {
          await cancelReminder(updatedTask.notificationId);
        }
        updatedTask.notificationId = await scheduleReminderTasks(updatedTask);
      } catch (error) {
        console.warn("Failed to schedule notification:", error);
        return { status: "partial_success", reason: "Failed to schedule notification", task: updatedTask };
      }
    }
    /* context.setTasks((prev) =>
      prev.map((t) => (t.id.slice(0, 8) === params.id ? updatedTask : t))
    ); */
    AIActionMemory.push({ type: 'REVERT_UPDATE_TASK', payload: { task: oldTask }, timestamp: Date.now() });
    context.trackMetric(["tasksEdited"], 1);
    await context.editTask(updatedTask);
    const { id, embedding, ...rest } = updatedTask;
    return { status: "success", task: { id: id.slice(0, 8), ...rest } }
  }
};

export const DeleteTaskHandler: AIHandler = {
  execute: async (params, context) => {
    const oldTask = context.tasks.find((t) => t.id.slice(0, 8) === params.id);
    if (!oldTask) {
      throw new Error("Task not found");
    }
    if (oldTask.notificationId) {
      await cancelReminder(oldTask.notificationId);
    }
    AIActionMemory.push({ type: 'ADD_DELETED_TASK', payload: { task: oldTask }, timestamp: Date.now() });
    await context.removeTask(oldTask.id);
    if (oldTask.completed) {
      context.trackMetric(["tasksDeleted"], 1);
    } else {
      context.trackMetric(["tasksDeleted", "tasksAbandoned"], 1);
    }
    const { id, title } = oldTask;
    return { status: "success", task: { id: id.slice(0, 8), title } }
  }
};

export const CompleteTaskHandler: AIHandler = {
  execute: async (params, context) => {
    const oldTask = context.tasks.find((t) => t.id.slice(0, 8) === params.id);
    if (!oldTask) {
      throw new Error("Task not found");
    }
    if (oldTask.notificationId) {
      await cancelReminder(oldTask.notificationId);
    }
    AIActionMemory.push({ type: 'REVERT_UPDATE_TASK', payload: { task: oldTask }, timestamp: Date.now() });
    await context.toggleTask(oldTask.id);
    context.trackMetric(["tasksCompleted"], 1);
    const { id, title } = oldTask;
    return { status: "success", task: { id: id.slice(0, 8), title } }
  }
};

export const BatchMutateTasksHandler: AIHandler = {
  execute: async (params, context) => {
    const { searchFilters, mutationPayload } = params;
    const cateogryId = searchFilters.categoryName ? resolveIdsFromNames(searchFilters.categoryName, context.categories)[0] : undefined;
    // 1. O(N) Hard Filtering
    let targets = (context.tasks || []).filter((task: Task) => {
      const currentStatus = task.completed ? "completed" : new Date(task.dueDate) < new Date() ? "overdue" : "pending";
      if (searchFilters.status && searchFilters.status !== "all" && currentStatus !== searchFilters.status) return false;
      if (searchFilters.priority && searchFilters.priority !== "all" && task.priority !== searchFilters.priority) return false;
      if (searchFilters.categoryName && task.category !== cateogryId) return false; // Assumes category UUID resolution happened upstream
      return true;
    });

    // 2. High-Compute Semantic Filtering
    if (searchFilters.semanticQuery && targets.length > 0) {
      const queryVector = await generateEmbedding(searchFilters.semanticQuery, true);
      targets = targets.filter((t: any) => {
        if (!t.embedding) return false;
        // Strict threshold (0.75+) to prevent accidental mutations of loosely related tasks
        return fastCosineSimilarity(queryVector, t.embedding) > 0.75;
      });
    }

    if (targets.length === 0) {
      return { output: "No tasks matched the criteria for batch mutation. No changes were made." };
    }

    // 3. Push to Undo Memory Stack PRIOR to mutation
    AIActionMemory.push({
      type: 'BATCH_REVERT_TASKS',
      payload: { originalTasks: targets }, timestamp: Date.now()
    });

    // 4. Execute Atomic Update
    const newCateogryId = mutationPayload.category ? resolveIdsFromNames(mutationPayload.category, context.categories)[0] : undefined;
    if (newCateogryId) {
      mutationPayload.category = newCateogryId;
    }
    try {
      await context.batchMutateTasks(targets, mutationPayload);
      return { output: `Successfully batch updated ${targets.length} tasks.` };
    } catch (error) {
      return { error: "Database transaction failed. All partial updates were automatically rolled back." };
    }
  }
};

export const QueryTasksHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { status = "all", priority = "all", timeRange = "all", sortBy = "newest_first", specificTaskId, categoryName,
      tagNames } = args;

    if (specificTaskId) {
      const targetTask = context.tasks.find((t: any) => t.id.slice(0, 8) === specificTaskId);
      if (!targetTask) return { error: "Task not found in database." };

      return {
        output: {
          id: targetTask.id,
          t: targetTask.title,
          d: targetTask.description || "",
          p: targetTask.priority,
          due: targetTask.dueDate || "",
          tg: targetTask.tags || [],
          cat: targetTask.category || "",
          status: targetTask.completed ? "completed" : "pending",
          rem: targetTask.reminder ? 1 : 0,
          rd: targetTask.reminderDate || "",
          cd: targetTask.completedDate || "",
          ct: targetTask.createdAt,
          ut: targetTask.updatedAt
        }
      };
    }
    const targetCategoryId = categoryName ? resolveIdsFromNames(categoryName, context.categories)[0] : undefined;
    const targetTagIds = tagNames ? resolveIdsFromNames(tagNames, context.tags) : [];
    console.log("FOund tags and cat ids", targetTagIds, targetCategoryId);
    let filtered = [...context.tasks];
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));
    if (targetCategoryId) {
      filtered = filtered.filter(t => t.category === targetCategoryId);
    }

    if (targetTagIds.length > 0) {
      filtered = filtered.filter(t =>
        targetTagIds.every((tagId: string) => t.tags?.includes(tagId))
      );
    }
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

    const { rangeStart, rangeEnd } = getTimeRangeHelper(timeRange);
    // 3. Filter by Time Range (Relative Logic)
    if (timeRange !== "all") {
      filtered = filtered.filter(t => {
        if (!rangeStart || !rangeEnd) return true;
        const taskDate = new Date(t.dueDate);
        return taskDate >= rangeStart && taskDate <= rangeEnd;
      });
    }
    console.log("QUERY TASKS: FILTERED", filtered.map(t => t.title));
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

    if (filtered.length === 0) return { output: "No relevant Tasks found" };

    // 5. Return Summary (ID, Title, Status, DueDate)
    return {
      output: filtered.map(t => ({
        id: t.id.slice(0, 8),
        t: t.title,
        d: t.description,
        due: t.dueDate,
        p: t.priority,
        tg: t.tags,
        cat: t.category,
        rem: t.reminder ? 1 : 0,
        rd: t.reminderDate,
        cd: t.completedDate,
        ct: t.createdAt,
        ut: t.updatedAt,
        status: t.completed ? "completed" : new Date(t.dueDate) < startOfToday ? "overdue" : "pending",
      })),
      count: filtered.length
    };
  }
};