import type {
    GlobalSearchActionDefinition,
} from "@/types/global-search";

const startTimerAction = {
    id: "start_timer",
    title: "Start Timer",
    subtitle: "Start a focused session",

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