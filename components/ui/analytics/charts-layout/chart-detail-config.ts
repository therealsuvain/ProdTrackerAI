export interface DetailScale {
  heightScale: number;
  widthScale: number;
}

export interface ChartInfoDetails {
  title: string;
  description: string;
   howToRead: {
    xAxis : string;
    yAxis : string;
    extraInfo?: string;
  }; 
  extraInfo?: string;
}


const DEFAULT_DETAIL_SCALE: DetailScale = { heightScale: 2, widthScale: 1 };

// How much bigger each chart renders in the standalone detail modal vs its
// grid tile. Most charts just need more vertical room — their width already
// reads fine at the grid's '90%'. A couple (mainly circular ones) want both
// axes scaled together so they don't stretch into an oval.
export const CHART_DETAIL_SCALE: Record<string, DetailScale> = {
  execution_funnel: { heightScale: 2, widthScale: 1 },
  momentum_delta: { heightScale: 2, widthScale: 1 },
  time_durations: { heightScale: 2, widthScale: 1 },
  task_velocity: { heightScale: 2, widthScale: 1 },
  habit_consistency: { heightScale: 2, widthScale: 1 },
  task_throughput: { heightScale: 2, widthScale: 1 },
  ai_leverage: { heightScale: 2, widthScale: 1 },
  circadian_friction: { heightScale: 1.8, widthScale: 1.3 },
  deep_work: { heightScale: 1.6, widthScale: 1.6 },
};

export function getDetailScale(id: string): DetailScale {
  return CHART_DETAIL_SCALE[id] ?? DEFAULT_DETAIL_SCALE;
}

// Every chart's base (grid) container height, kept here so the modal can
// compute a wrapper size without re-deriving it. Must match each chart's own
// `chartContainer.height`.
export const BASE_CHART_HEIGHT = 400;
export const MODAL_BASE_WIDTH = 640;

export const CHART_INFO_DETAILS : Record<string, ChartInfoDetails>= {
execution_funnel: { 
  title: 'Execution Funnel - Multi-Bar Chart', 
  description: 'The funnel shows the distribution of tasks by status',
   howToRead: {
    xAxis : " X-Axis : Represents the time period over which the data is being displayed",
    yAxis : " Y-Axis : Represents the number of tasks completed, missed, or abandoned, each with a seperate bar",
   } 
  },
  momentum_delta: { 
    title: 'Momentum Delta - Area Chart', 
    description: 'The momentum delta chart shows overall app ultilization for managing for daily life', 
    howToRead:{
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the 7-Day rolling average of all activities performed , task completed + habits checked in + Logs added",
      extraInfo : "* A rolling average (or moving average) is a calculation used to analyze data points by creating a series of averages of a fixed window size. Each point of the represents the avg of the last 7 days including that day"
    } 
  },
  timed_durations: { 
    title: 'Timed Durations - Area Chart', 
    description: 'The timed durations chart shows what time of the day you focus down and log timers', 
    howToRead: {
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the sum of all activities performed , task completed + habits checked in + ....",
    }
  },
  task_velocity: { 
    title: 'Task Velocity - Area Chart', 
    description: 'The task velocity chart shows your focus over time.', 
     howToRead: {
      xAxis : " X-Axis : Represents the 5 different time durations of the day",
      yAxis : " Y-Axis : Represents at what time of day due to usually finish of tasks",
      extraInfo: "\nEarly Morning - 5am to 8am\n Morning - 8am to 12pm\n Afternoon - 12pm to 5pm\n Evening - 5pm to 9pm\n Night - 9pm to 5am",
    }
  },
  habit_consistency: { 
    title: 'Habit Consistency - Bar Chart', 
    description: 'The habit consistency chart shows your focus over time.', 
    howToRead: {
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the number of habits checked in based on defined goals",
    }
  },
  task_throughput: {
    title: 'Task Throughput - Multi Bar Chart', 
    description: 'The task throughput chart shows your focus over time.', 
    howToRead: {
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the number of tasks completed on time vs late, each with a seperate bar",
    }
  },
  ai_leverage: { 
    title: 'AI Leverage - To be changed', 
    description: 'The AI leverage chart shows your focus over time.', 
    howToRead: {
      xAxis : " X-Axis : 11111Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : 1111111Represents the number of tasks completed on time vs late, each with a seperate bar",
    }
  },
  circadian_friction: { 
    title: 'Circadian Friction - Scatter Plot', 
    description: 'The circadian friction chart shows loss of consistency over late night completions in early morning completions', 
    howToRead: {
      xAxis : " X-Axis : Represents LATE NIGHTS",
      yAxis : " Y-Axis : Represents EARLY MORNING",
    }
  },
  deep_work: {
    title: 'Deep Work - Pie Chart', 
    description: 'The deep work chart shows your time tracked across different categories.', 
    howToRead: {
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the number of tasks completed on time vs late, each with a seperate bar",
    }
  },
  task_procrastination: { 
    title: 'Task Procrastination Lag', 
    description: 'The task procrastination lag chart shows delay in task completion after task deadline.', 
    howToRead: {
      xAxis : " X-Axis : Represents the time period over which the data is being displayed",
      yAxis : " Y-Axis : Represents the number of tasks completed on time vs late, each with a seperate bar",
    } 
  },
}