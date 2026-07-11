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
import { FocusTrendChart } from './charts/chart-cartesian-area-focus-trend';
import { TaskThroughputChart } from './charts/chart-cartesian-bar-task-throughput';

export interface ChartProps{
  metrics: AppMetrics;
  tasks? : Task[];
  habits? : Habit[];
  logs? : TimerLog[];
  events? : CalendarEvent[];
  tags? : Tag[];
  categories? : Category[];
  variant?: 'grid' | 'detail';
  transformState : any
}
export const CHART_REGISTRY: Record<string, React.FC<ChartProps>> = {
  execution_funnel: ExecutionFunnelChart,
  deep_work: DeepWorkChart,
  circadian_friction: CircadianFrictionChart,
  ai_leverage: AILeverageChart,
  momentum_delta: MomentumDeltaChart,
  task_velocity : TaskVelocityChart,
  habit_consistency : HabitConsistencyChart,
  focus_trend : FocusTrendChart,
  task_throughput : TaskThroughputChart
};

export const DEFAULT_LAYOUT = [
  'execution_funnel',
  'deep_work',
  'circadian_friction',
  'ai_leverage',
  'momentum_delta'
];