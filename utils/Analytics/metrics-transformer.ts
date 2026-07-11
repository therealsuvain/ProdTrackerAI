import { Category } from '@/types/category';
import { AppMetrics, DailyMetrics } from '@/types/metrics'; // Adjust path as needed
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
  getAILeverageData(dailyData: Record<string, DailyMetrics>) {
    return Object.keys(dailyData)
      .sort()
      .map(date => ({
        date,
        timeTracked: dailyData[date].timeTracked ?? 0,
        aiActions: dailyData[date].chatActionsConfirmed ?? 0,
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
        sum += (targetDay.tasksCompleted ?? 0) + (targetDay.habitsCheckedIn ?? 0);
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
  getTaskVelocity(tasks: Task[] = []): { hour: number; completions: number }[] {
    const today = new Date().toDateString();
    
    // Initialize a 24-hour array with 0 completions
    const velocityMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, completions: 0 }));

    tasks.forEach(task => {
      if (task.completedAt && new Date(task.completedAt).toDateString() === today) {
        const hour = new Date(task.completedAt).getHours();
        velocityMap[hour].completions += 1;
      }
    });

    return velocityMap;
  },
  getTaskThroughput(tasks: Task[] = []) {
    const throughputMap = tasks.reduce((acc, task) => {
      // Aggregate Creation
      if (task.dueDate) {
        const due = new Date(task.dueDate).toISOString().split('T')[0];
        if (!acc[due]) acc[due] = { date: due, due: 0, completed: 0 };
        acc[due].due += 1;
      }
      
      // Aggregate Completion
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
        if (!acc[completedDate]) acc[completedDate] = { date: completedDate, due: 0, completed: 0 };
        acc[completedDate].completed += 1;
      }
      return acc;
    }, {} as Record<string, { date: string; due: number; completed: number }>);
  //console.log(Object.values(throughputMap).sort((a, b) => a.date.localeCompare(b.date)));
    return Object.values(throughputMap).sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Aggregates total focus duration per day from raw logs.
   * Provides a macro-view of deep work consistency.
   */
  getFocusTrend(logs: TimerLog[] = []) {
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
   * Utilizes the raw AppMetrics daily dictionary.
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