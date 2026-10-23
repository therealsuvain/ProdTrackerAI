import type {
    GlobalSearchSelectionRequest,
    GlobalSearchTarget,
} from "@/types/global-search";

export interface GlobalSearchNavigationIntent {
    pathname: string;
    params: Record<string, string>;
    withAnchor?: boolean;
}

export interface GlobalSearchSelectionHandlers {
    navigate: (intent: GlobalSearchNavigationIntent) => void;
    onUnsupportedTarget?: (target: GlobalSearchTarget) => void;
}

let requestSequence = 0;

export function createGlobalSearchSelectionRequest(
    target: GlobalSearchTarget,
    context?: GlobalSearchSelectionRequest["context"],
): GlobalSearchSelectionRequest {
    requestSequence += 1;

    return {
        requestId: `${Date.now()}-${requestSequence}`,
        source: "global-search",
        target,
        ...(context ? { context } : {}),
    };
}

const RECORD_ROUTES = {
    task: "/(tabs)/task-screen",
    event: "/(tabs)/calendar-screen",
    habit: "/(tabs)/habits-screen",
    log: "/(tabs)/timer-screen",
    tag: "/settings/tags/tags-settings",
    category: "/settings/category/category-settings",
    achievement: "/achievements",
} as const;

/**
 * Dispatches the selection to its appropriate handler.
 *
 * This phase preserves the existing record-focus navigation protocol.
 * Additional target kinds will be implemented in later phases.
 *
 * Returns true when the request was handled.
 */
export function dispatchGlobalSearchSelection(
    request: GlobalSearchSelectionRequest,
    handlers: GlobalSearchSelectionHandlers,
): boolean {
    const { target } = request;

    switch (target.kind) {
        case "task":
        case "event":
        case "habit":
        case "log": {
            const params: Record<string, string> = {
                focusItemId: target.id,
                focusItemType: target.kind,
                focusRequestId: request.requestId,
            };

            // Reserved for the calendar-occurrence implementation in Phase 9.
            if (request.context?.occurrenceDate) {
                params.occurrenceDate = request.context.occurrenceDate;
            }

            handlers.navigate({
                pathname: RECORD_ROUTES[target.kind],
                params,
            });

            // console.log(params)
            return true;
        }
        case "tag":
        case "category": {
            handlers.navigate({
                pathname: RECORD_ROUTES[target.kind],
                params: {
                    focusItemId: target.id,
                    focusItemType: target.kind,
                    focusRequestId: request.requestId,

                    // Consumed by the destination screen to open the existing edit modal.
                    openEditItemId: target.id,
                    openEditRequestId: request.requestId,
                },
                withAnchor: true,
            });

            return true;
        }

        case "achievement": {
            handlers.navigate({
                pathname: RECORD_ROUTES.achievement,
                params: {
                    focusItemId: target.id,
                    focusItemType: "achievement",
                    focusRequestId: request.requestId,
                },
            });

            return true;
        }
        default:
            handlers.onUnsupportedTarget?.(target);
            return false;
    }
}