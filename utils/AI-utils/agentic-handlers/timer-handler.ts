import { AIHandler } from "@/types/ai-handler";
import { resolveIdsFromNames } from "./tags-and-categories-handlers";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { getCategoryList } from "@/stores/use-category-store";
import { getTagList } from "@/stores/use-tag-store";

export const StartTimerHandler: AIHandler = {
  execute: async (params, context) => {
    context.setTitle(params.title || "Unnamed Timer");
    context.start();
    context.navigation.navigate("timer-screen");

    console.log(`AI Action: Started timer for "${params.title}"`);
  }
};

export const StopTimerHandler: AIHandler = {
  execute: async (params, context) => {
    context.stop();
    context.navigation.navigate("timer-screen");

    console.log(`AI Action: Stopped timer`);
  }
};

export const QueryTimerLogsHandler: AIHandler = {
  execute: async (args: any) => {
    const { minDurationMinutes, maxDurationMinutes, sortBy = "newest_first", specificLogId, categoryName,
      tagNames } = args;
    const timerLogs = Object.values(useTimerLogStore.getState().logsById);
    // DEEP DIVE: Specific Timer Log
    if (specificLogId) {
      const targetLog = timerLogs.find((l: any) => l.id === specificLogId);
      if (!targetLog) return { error: "Timer log not found in database." };

      return {
        id: targetLog.id,
        title: targetLog.title,
        startTime: targetLog.startTime,
        endTime: targetLog.endTime || "Currently Running",
        durationMinutes: targetLog.duration ? Math.floor(targetLog.duration / 60) : 0,
        durationSeconds: targetLog.duration || 0
      };
    }
    const categories = getCategoryList();
    const tags = getTagList();
    const targetCategoryId = categoryName ? resolveIdsFromNames(categoryName, categories)[0] : undefined;
    const targetTagIds = tagNames ? resolveIdsFromNames(tagNames, tags) : [];
    let filtered = [...(timerLogs || [])];
    if (targetCategoryId) {
      filtered = filtered.filter(t => t.category === targetCategoryId);
    }

    if (targetTagIds.length > 0) {
      filtered = filtered.filter(t =>
        targetTagIds.every((tagId: string) => t.tags?.includes(tagId))
      );
    }
    // Filter by Duration (Convert minutes from AI into seconds for DB comparison)
    if (minDurationMinutes !== undefined) {
      filtered = filtered.filter(log => (log.duration || 0) >= minDurationMinutes * 60);
    }
    if (maxDurationMinutes !== undefined) {
      filtered = filtered.filter(log => (log.duration || 0) <= maxDurationMinutes * 60);
    }

    // Sort Logic
    filtered.sort((a, b) => {
      if (sortBy === "duration_desc") return (b.duration || 0) - (a.duration || 0);
      if (sortBy === "duration_asc") return (a.duration || 0) - (b.duration || 0);
      if (sortBy === "newest_first") return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      if (sortBy === "oldest_first") return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return 0;
    });

    return {
      results: filtered.map(log => ({
        id: log.id.slice(0, 8),
        title: log.title,
        started: log.startTime,
        durationMinutes: log.duration ? Math.floor(log.duration / 60) : 0
      }))
    };
  }
};