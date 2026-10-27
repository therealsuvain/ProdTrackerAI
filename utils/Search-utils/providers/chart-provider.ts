import {
  getGlobalSearchKey,
  type GlobalSearchDocument,
  type GlobalSearchProvider,
} from "@/types/global-search";

import type { GlobalSearchProviderContext } from "@/types/global-search";
import { tierAtLeast } from "@/types/entitlement";

interface ChartMetadata {
  title: string;
  description: string;
  aliases: readonly string[];
}

const CHART_METADATA: Record<string, ChartMetadata> = {
  execution_funnel: {
    title: "Execution Funnel",
    description: "How tasks move from creation to completion",
    aliases: ["task completion funnel", "execution rate"],
  },
  deep_work: {
    title: "Deep Work",
    description: "Focused timer sessions and deep work time",
    aliases: ["focus time", "focused sessions", "concentration"],
  },
  circadian_friction: {
    title: "Circadian Friction",
    description: "Patterns in activity and productivity throughout the day",
    aliases: ["time of day", "daily productivity", "circadian rhythm"],
  },
  ai_leverage: {
    title: "AI Leverage",
    description: "How AI assistance contributes to task execution",
    aliases: ["AI usage", "AI productivity", "assistant impact"],
  },
  momentum_delta: {
    title: "Momentum Delta",
    description: "Changes in productivity momentum over time",
    aliases: ["momentum", "productivity trend"],
  },
  task_velocity: {
    title: "Task Velocity",
    description: "The rate at which tasks are completed",
    aliases: ["task speed", "completion speed"],
  },
  habit_consistency: {
    title: "Habit Consistency",
    description: "Consistency of habit check-ins over time",
    aliases: ["habit streaks", "habit adherence"],
  },
  timed_durations: {
    title: "Timed Durations",
    description: "How recorded timer time is distributed",
    aliases: ["timer duration", "time tracking"],
  },
  task_throughput: {
    title: "Task Throughput",
    description: "The volume of tasks completed in a period",
    aliases: ["tasks per day", "completed task volume"],
  },
  task_procrastination: {
    title: "Task Procrastination",
    description: "Patterns of delaying tasks and completing them late",
    aliases: ["late tasks", "task delays"],
  },
  priority_completion: {
    title: "Priority Completion",
    description: "Completion patterns across task priorities",
    aliases: ["high priority tasks", "priority breakdown"],
  },
  freeze_reliance: {
    title: "Freeze Reliance",
    description: "How often habit streak freezes are used",
    aliases: ["streak freeze usage", "habit freezes"],
  },
  chat_follow_through: {
    title: "Chat Follow-Through",
    description: "Whether AI chat leads to completed actions",
    aliases: ["AI action completion", "chat outcomes"],
  },
  session_distribution: {
    title: "Session Distribution",
    description: "Distribution of timer sessions and their lengths",
    aliases: ["timer sessions", "session breakdown"],
  },
};

function formatFallbackTitle(chartId: string): string {
  return chartId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const chartSearchProvider: GlobalSearchProvider<
  readonly string[]
> = {
  id: "chart",

  buildDocuments(chartIds, context: GlobalSearchProviderContext) {
    // Analytics requires Gold in the existing navigation gate.
    // Don't expose charts before entitlements are loaded.
    if (
      !context.isEntitlementLoaded ||
      !tierAtLeast(context.plan, "gold")
    ) {
      return [];
    }

    return chartIds.map((chartId): GlobalSearchDocument => {
      const metadata = CHART_METADATA[chartId] ?? {
        title: formatFallbackTitle(chartId),
        description: `Analytics chart for ${formatFallbackTitle(chartId)}`,
        aliases: [],
      };

      return {
        key: getGlobalSearchKey({
          kind: "chart",
          chartId,
        }),
        kind: "chart",
        target: {
          kind: "chart",
          chartId,
        },
        display: {
          title: metadata.title,
          subtitle: "Analytics chart",
          presentation: {
            icon: {
              family: "material-community",
              name: "chart-box-outline",
            },
            accentColor: "#acfd93",
          },
        },
        fields: [
          {
            kind: "description",
            value: metadata.description,
          },
          ...metadata.aliases.map((alias) => ({
            kind: "alias" as const,
            value: alias,
          })),
        ],
        access: {
          requiredTier: "gold",
        },
      };
    });
  },
};