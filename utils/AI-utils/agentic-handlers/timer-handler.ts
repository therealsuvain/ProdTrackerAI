import { AIHandler } from "@/types/ai-handler";

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
  execute: async (args: any, context: any) => {
    const { minDurationMinutes, maxDurationMinutes, sortBy = "newest_first", specificLogId } = args;

    // DEEP DIVE: Specific Timer Log
    if (specificLogId) {
      const targetLog = context.timerLogs.find((l: any) => l.id === specificLogId);
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

    let filtered = [...(context.timerLogs || [])];

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