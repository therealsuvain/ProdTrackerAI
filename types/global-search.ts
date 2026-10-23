import type { PlanTier } from "@/types/entitlement";

// ==================================================
// 1. Result kinds
// ==================================================

export type GlobalSearchKind =
    | "task"
    | "event"
    | "habit"
    | "log"
    | "tag"
    | "category"
    | "achievement"
    | "setting"
    | "chart"
    | "action"
    | "easterEgg";

// Easter eggs appear in a special section, not a filter chip.
export type GlobalSearchFilterKind = Exclude<
    GlobalSearchKind,
    "easterEgg"
>;

// ==================================================
// 2. Typed selection targets
// ==================================================

export type GlobalSearchTarget =
    | { kind: "task"; id: string }
    | { kind: "event"; id: string }
    | { kind: "habit"; id: string }
    | { kind: "log"; id: string }
    | { kind: "tag"; id: string }
    | { kind: "category"; id: string }
    | { kind: "achievement"; id: string }
    | { kind: "setting"; id: string; href?: string }
    | { kind: "chart"; chartId: string }
    | { kind: "action"; actionId: string }
    | { kind: "easterEgg"; eggId: string };

// Globally namespaced key for deduplication and FlatList keys.
export function getGlobalSearchKey(
    target: GlobalSearchTarget,
): string {
    switch (target.kind) {
        case "task":
        case "event":
        case "habit":
        case "log":
        case "tag":
        case "category":
        case "achievement":
        case "setting":
            return `${target.kind}:${target.id}`;

        case "chart":
            return `chart:${target.chartId}`;

        case "action":
            return `action:${target.actionId}`;

        case "easterEgg":
            return `easterEgg:${target.eggId}`;
    }
}

// ==================================================
// 3. Searchable fields and documents
// ==================================================

export type GlobalSearchFieldKind =
    | "description"
    | "tag"
    | "category"
    | "unlockedDescription"
    | "settingGroup"
    | "alias";

export interface GlobalSearchField {
    kind: GlobalSearchFieldKind;

    // Original text. Normalization belongs to the
    // matching engine, not the provider.
    value: string;

    // Optional ID of the matched tag/category, etc.
    sourceId?: string;
}

export interface GlobalSearchPresentation {
    icon?: {
        family:
        | "ionicons"
        | "material"
        | "material-community"
        | "fontawesome6";
        name: string;
    };

    // Mainly useful for category-specific accents.
    // Ordinary type colors can remain in UI metadata.
    accentColor?: string;
}

export interface GlobalSearchAccess {
    requiresPaidMode?: boolean;
    requiredTier?: PlanTier;
}

interface GlobalSearchDocumentBase {
    // Unique, namespaced identity, e.g. "task:123".
    key: string;

    display: {
        title: string;
        subtitle?: string;
        presentation?: GlobalSearchPresentation;
    };

    // Supplemental text fields. display.title is
    // searched separately and should not be duplicated.
    fields: readonly GlobalSearchField[];

    // Filtering uses stable IDs rather than display names.
    facets?: {
        tagIds?: readonly string[];
        categoryIds?: readonly string[];
    };

    // Additional eligibility metadata when necessary.
    access?: GlobalSearchAccess;
}

// The mapped union ensures that a document's kind
// and its selection target always correspond.
export type GlobalSearchDocument = {
    [K in GlobalSearchKind]: GlobalSearchDocumentBase & {
        kind: K;
        target: Extract<GlobalSearchTarget, { kind: K }>;
    };
}[GlobalSearchKind];

// ==================================================
// 4. Match explanations and scored results
// ==================================================

export type GlobalSearchMatchField =
    | "title"
    | GlobalSearchFieldKind
    | "eggTrigger";

export type GlobalSearchMatchQuality =
    | "exact-title"
    | "title-prefix"
    | "title-phrase"
    | "title-token"
    | "fuzzy-title"
    | "description"
    | "unlocked-description"
    | "metadata"
    | "secondary-context"
    | "exact-trigger"
    | "filter-only";

export interface GlobalSearchMatch {
    score: number;
    quality: GlobalSearchMatchQuality;
    field: GlobalSearchMatchField;

    // Text responsible for the match, where available.
    matchedText?: string;

    // Concise snippet from the matching field.
    snippet?: string;
}

export interface GlobalSearchResult {
    document: GlobalSearchDocument;
    match: GlobalSearchMatch;
}

// ==================================================
// 5. Active search filters
// ==================================================

export interface GlobalSearchFilters {
    type: "all" | GlobalSearchFilterKind;

    categoryIds: readonly string[];
    tagIds: readonly string[];

    // All = every selected tag must match.
    // Any = at least one selected tag must match.
    tagMatchMode: "all" | "any";
}

// ==================================================
// 6. Provider contract
// ==================================================

export type GlobalSearchProviderId = Exclude<
    GlobalSearchKind,
    "action" | "easterEgg"
>;

export interface GlobalSearchProviderContext {
    tagsById: ReadonlyMap<
        string,
        {
            name: string;
            normalizedName?: string;
        }
    >;

    categoriesById: ReadonlyMap<
        string,
        {
            name: string;
            normalizedName?: string;
            color?: string;
        }
    >;

    paidModeEnabled: boolean;
    plan: PlanTier;
    isEntitlementLoaded: boolean;
}

export interface GlobalSearchProvider<TSource> {
    readonly id: GlobalSearchProviderId;

    buildDocuments(
        source: TSource,
        context: GlobalSearchProviderContext,
    ): readonly GlobalSearchDocument[];
}

// ==================================================
// 7. Selection and navigation requests
// ==================================================

export interface GlobalSearchSelectionRequest {
    requestId: string;
    source: "global-search";
    target: GlobalSearchTarget;

    // Added when a target needs occurrence context,
    // particularly for recurring Calendar events.
    context?: {
        occurrenceDate?: string;
    };
}

// ==================================================
// 8. Registered actions
// ==================================================

export interface GlobalSearchActionContext {
    // Navigates to Timer with a one-time start request.
    // The Timer screen consumes it and calls the existing
    // startTimerWithEffects() function.
    navigateToTimerWithStartRequest: () => void | Promise<void>;
}

export interface GlobalSearchActionDefinition {
    id: string;
    title: string;
    subtitle?: string;
    aliases?: readonly string[];
    presentation?: GlobalSearchPresentation;

    isAvailable?: (
        context: GlobalSearchActionContext,
    ) => boolean;

    execute: (
        context: GlobalSearchActionContext,
    ) => void | Promise<void>;
}

// ==================================================
// 9. Easter-egg definitions and discovery
// ==================================================

export type GlobalSearchEasterEggActivation =
    | {
        kind: "externalUrl";
        url: string;
    }
    | {
        kind: "animation";
        effect:
        | "launchSequence"
        | "answer42"
        | "helloThere"
        | "abracadabra";
    };

export interface GlobalSearchEasterEggDefinition {
    id: string;
    triggers: readonly string[];
    title: string;
    subtitle?: string;
    presentation?: GlobalSearchPresentation;
    activation: GlobalSearchEasterEggActivation;
}

export interface DiscoveredGlobalSearchEasterEgg {
    eggId: string;
    discoveredAt: string;
}