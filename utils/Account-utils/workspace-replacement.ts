import { 
    achievementGlobalMetrics, 
    calendarEvents,  eventDeletedOccurrences, eventNotificationIds,eventTags,
    categories, 
    dailyMetrics, dailyMetricsAI, 
    db,   
    globalMetrics, globalMetricsAI, 
    habitCheckIns, habitFreezeHistory, habitGoalCompletions, habitTags, habits, 
    tags, 
    taskTags, tasks, 
    timerLogs, timerTags, 
    unlockedAchievements 
} from "@/db";

export async function clearActiveWorkspace(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(taskTags);
    await tx.delete(habitTags);
    await tx.delete(eventTags);
    await tx.delete(timerTags);

    await tx.delete(habitCheckIns);
    await tx.delete(habitFreezeHistory);
    await tx.delete(habitGoalCompletions);

    await tx.delete(eventDeletedOccurrences);
    await tx.delete(eventNotificationIds);

    await tx.delete(tasks);
    await tx.delete(habits);
    await tx.delete(calendarEvents);
    await tx.delete(timerLogs);
    await tx.delete(categories);
    await tx.delete(tags);

    await tx.delete(unlockedAchievements);

    await tx.delete(dailyMetrics);
    await tx.delete(globalMetrics);
    await tx.delete(dailyMetricsAI);
    await tx.delete(globalMetricsAI);
    await tx.delete(achievementGlobalMetrics);
  });
}

export async function clearWorkspaceInTransaction(tx: any): Promise<void> {
  await tx.delete(taskTags);
  await tx.delete(habitTags);
  await tx.delete(eventTags);
  await tx.delete(timerTags);

  await tx.delete(habitCheckIns);
  await tx.delete(habitFreezeHistory);
  await tx.delete(habitGoalCompletions);

  await tx.delete(eventDeletedOccurrences);
  await tx.delete(eventNotificationIds);

  await tx.delete(tasks);
  await tx.delete(habits);
  await tx.delete(calendarEvents);
  await tx.delete(timerLogs);
  await tx.delete(categories);
  await tx.delete(tags);

  await tx.delete(unlockedAchievements);

  await tx.delete(dailyMetrics);
  await tx.delete(globalMetrics);
  await tx.delete(dailyMetricsAI);
  await tx.delete(globalMetricsAI);
  await tx.delete(achievementGlobalMetrics);
}