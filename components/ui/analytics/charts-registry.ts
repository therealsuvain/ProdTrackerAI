import { AppMetrics } from '@/types/metrics';
import { ExecutionFunnelChart } from './charts/chart-cartesian-bar-execution-funnel';
import { MomentumDeltaChart } from './charts/chart-filled-area-momentum-delta';
import { AILeverageChart } from './charts/chart-line-AI-leverage-index';
import { CircadianFrictionChart } from './charts/chart-scatter-plot-circadian-friction';
import { DeepWorkChart } from './charts/charts-polar-dount-deep-work';
import { Category } from '@/types/category';
import { Habit } from '@/types/habits';
import { Tag } from '@/types/tag';
import { Task } from '@/types/task';
import { CalendarEvent } from '@/types/calendar';
import { TimerLog } from '@/types/timer';
import { TaskVelocityChart } from './charts/chart-cartesian-line-task-velocity';
import { HabitConsistencyChart } from './charts/chart-cartesian-line-habit-consistency';
import { TimedDurationsChart } from './charts/chart-cartesian-area-timed-durations';
import { TaskThroughputChart } from './charts/chart-cartesian-bar-task-throughput';
import { TaskProcrastinationLagChart } from './charts/chart-scatter-plot-task-procrastination-lag';
import { PriorityCompletionChart } from './charts/chart-cartesian-bar-task-priority-completion-rate';
import { FreezeRelianceChart } from './charts/chart-cartesian-bar-freeze-reliance';
import { ChatFollowThroughChart } from './charts/chart-polar-pie-chat-follow-through';
import { SessionDistributionChart } from './charts/chart-cartesian-bar-session-distribution';

export interface ChartProps{
  metrics: AppMetrics;
  tasks : Task[];
  habits : Habit[];
  logs : TimerLog[];
  events : CalendarEvent[];
  tags : Tag[];
  categories : Category[];
  variant?: 'grid' | 'detail';
  transformState? : any
  startDate?: string;
  endDate?: string
}
export const CHART_REGISTRY: Record<string, React.FC<ChartProps>> = {
  execution_funnel: ExecutionFunnelChart,
  deep_work: DeepWorkChart,
  circadian_friction: CircadianFrictionChart,
  ai_leverage: AILeverageChart,
  momentum_delta: MomentumDeltaChart,
  task_velocity : TaskVelocityChart,
  habit_consistency : HabitConsistencyChart,
  timed_durations : TimedDurationsChart,
  task_throughput : TaskThroughputChart,
  task_procrastination: TaskProcrastinationLagChart,
  priority_completion : PriorityCompletionChart,
  freeze_reliance : FreezeRelianceChart,
  chat_follow_through: ChatFollowThroughChart,
  session_distribution: SessionDistributionChart
};

export const CHART_FILTERS: Record<string, string> = {
  execution_funnel: 'daily',
  deep_work: 'raw',
  circadian_friction: 'daily',
  ai_leverage: 'daily',
  momentum_delta: 'daily',
  task_velocity : 'raw',
  habit_consistency : 'daily',
  timed_durations : 'raw',
  task_throughput :  'raw',
  task_procrastination:  'raw',
  priority_completion :  'raw',
  freeze_reliance : 'daily',
  chat_follow_through: 'daily',
  session_distribution:  'raw',
}
// chart-advanced-fields.ts
export const CHART_ADVANCED_FIELDS: Record<string, Array<"tags" | "categories" | "priority">> = {
  deep_work: ["tags", "categories"],
  task_velocity: ["tags", "categories", "priority"],
  timed_durations: ["tags", "categories"],
  task_throughput: ["tags", "categories", "priority"],
  task_procrastination: ["tags", "categories", "priority"],
  priority_completion: ["tags", "categories", "priority"],
  session_distribution: ["tags", "categories"],
};


export const DEFAULT_LAYOUT = [
  'execution_funnel',
  'deep_work',
  'circadian_friction',
  'ai_leverage',
  'momentum_delta'
];