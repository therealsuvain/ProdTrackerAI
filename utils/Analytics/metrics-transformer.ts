import { Category } from '@/types/category';
import { AppMetrics, DailyMetrics, DailyMetricsWithAI } from '@/types/metrics'; // Adjust path as needed
import { Task } from '@/types/task';
import { TimerLog } from '@/types/timer';


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
  getTaskVelocity(tasks: Task[] = [],windowDays = 30): { label: string; completions: number }[] {
   /* const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const hourMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, completions: 0 }));

  tasks.forEach(task => {
    if (!task.completedAt) return;
    const completedDate = new Date(task.completedAt);
    if (completedDate < cutoff) return;
    hourMap[completedDate.getHours()].completions += 1;
  });

  return hourMap; */
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

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
    if (completedDate < cutoff) return;
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

  getTaskThroughput(tasks: Task[] = []) {
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

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Aggregates total timer duration per day from raw logs.
   * 
   */
  getTimerDurations(logs: TimerLog[] = []) {
    const trendMap = logs.reduce((acc, log) => {
      if (!log.startTime || !log.duration) return acc;
      
      const date = new Date(log.startTime).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + log.duration;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(trendMap)
      .map(([date, duration]) => ({ date, duration }))
      .sort((a, b) => a.date.localeCompare(b.date));
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
  
};