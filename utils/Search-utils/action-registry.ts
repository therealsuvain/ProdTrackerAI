import type {
  GlobalSearchActionDefinition,
} from "@/types/global-search";

import {
  getGlobalSearchKey,
  type GlobalSearchDocument,
  type GlobalSearchField,
} from "@/types/global-search";

import {
  recordGlobalSearchCatalogueBuild,
  recordGlobalSearchProviderBuild,
  startGlobalSearchTimer,
} from "@/utils/Search-utils/diagnostics/search-diagnostics";

const startTimerAction = {
  id: "start_timer",
  title: "Start Timer",
  subtitle: "Start a focused session",
  aliases: ["start a focus session", "begin timer", "start stopwatch"],

  execute(context) {
    return context.navigateToTimerWithStartRequest();
  },
} satisfies GlobalSearchActionDefinition;

export const GLOBAL_SEARCH_ACTIONS = [
  startTimerAction,
] as const satisfies readonly GlobalSearchActionDefinition[];

export const GLOBAL_SEARCH_ACTIONS_BY_ID: ReadonlyMap<
  string,
  GlobalSearchActionDefinition
> = new Map(
  GLOBAL_SEARCH_ACTIONS.map((action) => [action.id, action]),
);

export function buildGlobalSearchActionDocuments(): GlobalSearchDocument[] {
  const startedAt = startGlobalSearchTimer();

  const documents = GLOBAL_SEARCH_ACTIONS.map(

    (action: GlobalSearchActionDefinition): GlobalSearchDocument => {
      const fields: GlobalSearchField[] = (action.aliases ?? []).map(
        (alias) => ({
          kind: "alias",
          value: alias,
        }),
      );

      return {
        key: getGlobalSearchKey({
          kind: "action",
          actionId: action.id,
        }),
        kind: "action",
        target: {
          kind: "action",
          actionId: action.id,
        },
        display: {
          title: action.title,
          subtitle: action.subtitle ?? "Quick action",
          presentation: {
            icon: action.presentation?.icon ?? {
              family: "material-community",
              name: "lightning-bolt-outline",
            },
            ...(action.presentation?.accentColor
              ? { accentColor: action.presentation.accentColor }
              : {}),
          },
        },
        fields,
      };
    },
  );
  recordGlobalSearchProviderBuild("actions", startedAt, documents.length);

  return documents;
}