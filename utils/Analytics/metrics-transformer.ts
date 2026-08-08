import { Category } from '@/types/category';
import { AppMetrics, DailyMetrics, DailyMetricsWithAI } from '@/types/metrics'; // Adjust path as needed
import { Task } from '@/types/task';
import { TimerLog } from '@/types/timer';

 const getDateRangeArray = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

function densifyDateBuckets<T extends { date: string }>(
  buckets: T[],
  emptyBucket: (date: string) => T,
  start: string,
  end: string,
): T[] {
  const byDate = new Map(buckets.map((b) => [b.date, b]));
  return getDateRangeArray(start, end).map((date) => byDate.get(date) ?? emptyBucket(date));
}

export const MetricsTransformer = {
  /**
   * Transforms daily metrics into an execution funnel vector.
   * Sorts chronologically to ensure the X-axis flows correctly.
   */
  getExecutionFunnelData(dailyData: Record<string, DailyMetrics>) {
    return Object.keys(dailyData)
      .sort()
      .map(date => ({
        x: date,
        completed: dailyData[date].tasksCompleted ?? 0,
        missed: dailyData[date].tasksMissed ?? 0,
        abandoned: dailyData[date].tasksAbandoned ?? 0,
      }));
  },

  /**
   * Maps AI actions against total time tracked to prove ROI.
   */
  getAILeverageData(dailyData: Record<string, DailyMetricsWithAI>) {
    return Object.keys(dailyData)
      .sort()
      .map(date => ({
        date,
        manualActions: dailyData[date].tasksAdded  -  dailyData[date].aiMetrics.tasksAdded  + 
        dailyData[date].tasksCompleted - dailyData[date].aiMetrics.tasksCompleted + 
        dailyData[date].tasksDeleted - dailyData[date].aiMetrics.tasksDeleted +
        dailyData[date].tasksEdited - dailyData[date].aiMetrics.tasksEdited +
        dailyData[date].habitsAdded - dailyData[date].aiMetrics.habitsAdded +
        dailyData[date].habitsCheckedIn  - dailyData[date].aiMetrics.habitsCheckedIn +  
        dailyData[date].habitsFrozen - dailyData[date].aiMetrics.habitsFrozen + 
        dailyData[date].habitsDeleted - dailyData[date].aiMetrics.habitsDeleted +
        dailyData[date].habitsEdited - dailyData[date].aiMetrics.habitsEdited +
        dailyData[date].eventsAdded  -  dailyData[date].aiMetrics.eventsAdded  + 
        dailyData[date].eventsDeleted - dailyData[date].aiMetrics.eventsDeleted +
        dailyData[date].eventsEdited - dailyData[date].aiMetrics.eventsEdited +
        dailyData[date].tagsAdded  -  dailyData[date].aiMetrics.tagsAdded  + 
        dailyData[date].tagsDeleted - dailyData[date].aiMetrics.tagsDeleted +
        dailyData[date].tagsEdited - dailyData[date].aiMetrics.tagsEdited +
        dailyData[date].categoriesAdded  -  dailyData[date].aiMetrics.categoriesAdded  + 
        dailyData[date].categoriesDeleted - dailyData[date].aiMetrics.categoriesDeleted +
        dailyData[date].categoriesEdited - dailyData[date].aiMetrics.categoriesEdited +
        dailyData[date].logsAdded  -  dailyData[date].aiMetrics.logsAdded  + 
        dailyData[date].logsDeleted - dailyData[date].aiMetrics.logsDeleted +
        dailyData[date].logsEdited - dailyData[date].aiMetrics.logsEdited ,

        aiActions: dailyData[date].aiMetrics.tasksAdded  + dailyData[date].aiMetrics.tasksCompleted +  dailyData[date].aiMetrics.tasksDeleted + dailyData[date].aiMetrics.tasksEdited + 
        dailyData[date].aiMetrics.habitsAdded + dailyData[date].aiMetrics.habitsCheckedIn + dailyData[date].aiMetrics.habitsFrozen + dailyData[date].aiMetrics.habitsEdited +
        dailyData[date].aiMetrics.habitsDeleted + dailyData[date].aiMetrics.eventsAdded + dailyData[date].aiMetrics.eventsDeleted + dailyData[date].aiMetrics.eventsEdited +
        dailyData[date].aiMetrics.tagsAdded + dailyData[date].aiMetrics.tagsDeleted + dailyData[date].aiMetrics.tagsEdited +
        dailyData[date].aiMetrics.categoriesAdded + dailyData[date].aiMetrics.categoriesDeleted + dailyData[date].aiMetrics.categoriesEdited +
        dailyData[date].aiMetrics.logsAdded + dailyData[date].aiMetrics.logsDeleted + dailyData[date].aiMetrics.logsEdited,
      }));
  },

  /**
   * Calculates a 7-day rolling average of total completions (tasks + habits).
   */
  getMomentumDelta(dailyData: Record<string, DailyMetrics>) {
    const dates = Object.keys(dailyData).sort();
    const windowSize = 7;

    return dates.map((date, index) => {
      let sum = 0;
      let count = 0;

      // Look back up to 7 days
      for (let i = Math.max(0, index - windowSize + 1); i <= index; i++) {
        const targetDay = dailyData[dates[i]];
        sum += (targetDay.tasksCompleted ?? 0) + (targetDay.habitsCheckedIn ?? 0) + (targetDay.logsAdded ?? 0);
        count++;
      }

      return {
        date,
        rollingAverage: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0,
      };
    });
  },

  /**
   * Correlates Day N's late night events with Day N+1's morning failures.
   */
  getCircadianFriction(dailyData: Record<string, DailyMetrics>) {
    const dates = Object.keys(dailyData).sort();
    const frictionData = [];

    for (let i = 0; i < dates.length - 1; i++) {
      const currentDay = dailyData[dates[i]];
      const nextDay = dailyData[dates[i + 1]];

      const lateNightHours = currentDay.eventsLatenight ?? 0;
      const morningFailures = (nextDay.tasksMissed ?? 0); // Add habit morning failures here if tracked

      if (lateNightHours > 0 || morningFailures > 0) {
        frictionData.push({ lateNightHours, morningFailures });
      }
    }
    return frictionData;
  },

  /**
   * Aggregates categorical deep work data for the donut chart.
   * Assumes timeLoggedByCategory exists, otherwise maps from raw logs.
   */
  getDeepWorkAllocation(logs: TimerLog[] = [], categories: Category[] = []) {
   // 1. Create a lookup dictionary for O(1) category resolution
    const categoryDict = categories.reduce((acc, category) => {
      acc[category.id] = category;
      return acc;
    }, {} as Record<string, Category>);

    // 2. Aggregate log durations by category ID
    const durationMap = logs.reduce((acc, log) => {
      // Fallback to 'uncategorized' if a log lacks a valid category association
      const key = log.category || 'uncategorized';
      acc[key] = (acc[key] || 0) + (log.duration || 0);
      return acc;
    }, {} as Record<string, number>);

    // 3. Transform the hash map into the sorted visualization vector
    return Object.entries(durationMap)
      .map(([categoryId, duration]) => {
        const categoryRef = categoryDict[categoryId];
        return {
          label: categoryRef?.name || 'Uncategorized',
          duration,
          color: categoryRef?.color || '#9E9E9E',
        };
      })
      .sort((a, b) => b.duration - a.duration);
    },

  /**
   * Maps task completions to their respective hours for the current day.
   * Time Complexity: O(T) where T is today's tasks.
   */
  getTaskVelocity(tasks: Task[] = []): { label: string; completions: number }[] {

  const buckets = {
    "Early Morning": 0,
    "Morning": 0,
    "Afternoon": 0,
    "Evening": 0,
    "Night": 0,
  };

  tasks.forEach(task => {
    if (!task.completedAt) return;
    const completedDate = new Date(task.completedAt);
    const hour = completedDate.getHours();

    if (hour >= 5 && hour < 8) buckets["Early Morning"]++;
    else if (hour >= 8 && hour < 12) buckets["Morning"]++;
    else if (hour >= 12 && hour < 17) buckets["Afternoon"]++;
    else if (hour >= 17 && hour < 21) buckets["Evening"]++;
    else buckets["Night"]++;
  });

  return Object.entries(buckets).map(([label, completions]) => ({ label, completions }));
  },

  getProcrastinationLag(tasks: Task[] = []) {
  return tasks
    .filter(t => t.completed && t.completedAt && t.dueDate)
    .map(t => {
      const due = new Date(t.dueDate);
      const completed = new Date(t.completedAt!);
      const lagDays = Math.round((completed.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return { date: t.completedAt!.split('T')[0], lagDays, title: t.title, priority: t.priority };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
},

  getTaskThroughput(tasks: Task[] = [], startDate: string, endDate: string) {
   const map = tasks.reduce((acc, task) => {
    if (!task.completed || !task.completedAt) return acc;

    const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
    if (!acc[completedDate]) {
      acc[completedDate] = { date: completedDate, onTime: 0, late: 0};
    }

    
      const due = new Date(task.dueDate);
      const completed = new Date(task.completedAt);
      if (completed.getTime() <= due.getTime() + 24 * 60 * 60 * 1000) {
        // grace of same-day completion
        acc[completedDate].onTime += 1;
      } else {
        acc[completedDate].late += 1;
      }
    
    return acc;
  }, {}as Record<string,{ date: string, onTime: number, late: number}>);

 // return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
 const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  return densifyDateBuckets(
    sorted,
    (date) => ({ date, onTime: 0, late: 0 }),
    startDate,
    endDate,
 );
 
  },

  /**
   * Aggregates total timer duration per day from raw logs.
   * 
   */
  getTimerDurations(logs: TimerLog[] = [], startDate: string, endDate: string) {
    const trendMap = logs.reduce((acc, log) => {
      if (!log.startTime || !log.duration) return acc;
      
      const date = new Date(log.startTime).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + log.duration;
      return acc;
    }, {} as Record<string, number>);

    /* return Object.entries(trendMap)
      .map(([date, duration]) => ({ date, duration }))
      .sort((a, b) => a.date.localeCompare(b.date)); */
      const sorted = Object.entries(trendMap)
     .map(([date, duration]) => ({ date, duration }))
     .sort((a, b) => a.date.localeCompare(b.date));

  return densifyDateBuckets(
    sorted,
    (date) => ({ date, duration: 0 }),
    startDate,
    endDate,
  );
  },

  /**
   * Calculates the rolling habit adherence percentage.
   * checked-in/ (checked-in + missed).
   */
  getHabitConsistency(dailyData: Record<string, any> = {}) {
    return Object.keys(dailyData)
      .sort()
      .map(date => {
        const day = dailyData[date];
        const completed = day.habitsCheckedIn ?? 0;
        const missed = day.habitsMissed ?? 0;
        const total = completed + missed;
        
        return {
          date,
          adherence: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      });
  }
  
,
  getFreezeReliance(dailyData: Record<string, any> = {}) {
  return Object.keys(dailyData).sort().map(date => ({
    date,
    manualFreezes: dailyData[date].habitsFrozen,
    autoFreezes: dailyData[date].habitsAutoFrozen,
  }));
},

getPriorityCompletionRate(tasks:Task[] = []) {
  const buckets = { high: { total: 0, completed: 0 }, medium: { total: 0, completed: 0 }, low: { total: 0, completed: 0 } };
  tasks.forEach(t => {
    buckets[t.priority].total += 1;
    if (t.completed) buckets[t.priority].completed += 1;
  });
  return Object.entries(buckets).map(([priority, { total, completed }]) => ({
    priority,
    rate: total > 0 ? (completed / total) * 100 : 0,
  }));
},

getChatFollowThrough(globalData: Record<string, any> = {}) {
  const total = globalData.chatActionsConfirmed + globalData.chatActionsExpired + globalData.chatActionsCancelled;
    return [
      {label: `Confirmed(${Math.round((globalData.chatActionsConfirmed / total) * 100)}%)`, value: globalData.chatActionsConfirmed, color: "green" },
      {label: `Expired(${Math.round((globalData.chatActionsExpired / total) * 100)})%`, value: globalData.chatActionsExpired, color: "red"},
      {label : `Cancelled(${Math.round((globalData.chatActionsCancelled / total) * 100)}%)`, value : globalData.chatActionsCancelled , color: "orange"}, 
      
];

},
getSessionLengthDistribution(timerLogs:TimerLog[] = []) {
  const buckets = { "<15min": 0, "15-30min": 0, "30-60min": 0, "60-120min": 0, ">120min": 0 };
  timerLogs.forEach(log => {
    if (!log.duration) return;
    const mins = log.duration / 60;
    if (mins < 15) buckets["<15min"]++;
    else if (mins < 30) buckets["15-30min"]++;
    else if (mins < 60) buckets["30-60min"]++;
    else if (mins < 120) buckets["60-120min"]++;
    else buckets[">120min"]++;
  });
  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

};