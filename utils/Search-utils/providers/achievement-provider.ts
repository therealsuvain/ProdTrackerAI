import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchField,
    type GlobalSearchProvider,
} from "@/types/global-search";

type RawRecord = Record<string, unknown>;

export interface AchievementSearchSource {
    definitions: readonly unknown[];
    unlockedAchievements: readonly unknown[];
    metricBaseline: object;
    metricGlobal: object;
}

function asRecord(value: unknown): RawRecord | null {
    return value !== null && typeof value === "object"
        ? (value as RawRecord)
        : null;
}

function textField(
    record: RawRecord,
    key: string,
): string | undefined {
    const value = record[key];

    return typeof value === "string" && value.trim()
        ? value.trim()
        : undefined;
}

function numberField(
    record: RawRecord,
    key: string,
): number | undefined {
    const value = record[key];

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}

function getMetricValue(source: object, metric: string): number {
    const value = (source as RawRecord)[metric];

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : 0;
}

const TIER_COLORS: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#A8A9AD",
    gold: "#D6A629",
    platinum: "#7E9BA9",
    diamond: "#58BFC4",
};

export const achievementSearchProvider: GlobalSearchProvider<
    AchievementSearchSource
> = {
    id: "achievement",

    buildDocuments(source, context) {
        const unlockedById = new Map<string, RawRecord>();

        for (const value of source.unlockedAchievements) {
            const unlocked = asRecord(value);
            const id = unlocked && textField(unlocked, "id");

            if (unlocked && id) {
                unlockedById.set(id, unlocked);
            }
        }

        const metricBaseline = source.metricBaseline;
        const metricGlobal = source.metricGlobal;
        const unlockedCount = unlockedById.size;

        const documents: GlobalSearchDocument[] = [];

        for (const value of source.definitions) {
            const definition = asRecord(value);
            if (!definition) continue;

            const id = textField(definition, "id");
            const title = textField(definition, "title");

            if (!id || !title) continue;

            const unlockedInfo = unlockedById.get(id);
            const isUnlocked = unlockedInfo !== undefined;

            // Don't reveal a hidden achievement before it is unlocked.
            const isHidden =
                definition.hidden === true ||
                definition.isHidden === true;

            if (isHidden && !isUnlocked) continue;

            // Respect an explicit paid-mode requirement if a definition has one.
            const requiresPaidMode = definition.requiresPaidMode === true;

            if (requiresPaidMode && !context.paidModeEnabled) continue;

            const description = textField(definition, "description");
            const unlockedDescription = isUnlocked
                ? textField(definition, "unlockedDescription")
                : undefined;

            const tier = textField(definition, "tier");
            const target = numberField(definition, "target");
            const metricTrigger = textField(definition, "metricTrigger");

            let currentProgress = 0;

            if (metricTrigger === "meta") {
                currentProgress = unlockedCount;
            } else if (metricTrigger) {
                currentProgress =
                    getMetricValue(metricGlobal, metricTrigger) -
                    getMetricValue(metricBaseline, metricTrigger);
            }

            const subtitle = isUnlocked
                ? `Unlocked${tier ? ` · ${tier}` : ""}`
                : target !== undefined
                    ? `${currentProgress}/${target} progress${tier ? ` · ${tier}` : ""}`
                    : `Locked${tier ? ` · ${tier}` : ""}`;

            const fields: GlobalSearchField[] = [];

            if (description) {
                fields.push({
                    kind: "description",
                    value: description,
                });
            }

            // Critical: never index unlockedDescription for locked achievements.
            if (unlockedDescription) {
                fields.push({
                    kind: "unlockedDescription",
                    value: unlockedDescription,
                });
            }

            documents.push({
                key: getGlobalSearchKey({
                    kind: "achievement",
                    id,
                }),
                kind: "achievement",
                target: {
                    kind: "achievement",
                    id,
                },
                display: {
                    title,
                    subtitle,
                    presentation: {
                        icon: {
                            family: "material-community",
                            name: "trophy-outline",
                        },
                        accentColor: TIER_COLORS[tier?.toLowerCase() ?? ""] ?? "#B69DE8",
                    },
                },
                fields,
                ...(requiresPaidMode
                    ? { access: { requiresPaidMode: true } }
                    : {}),
            });
        }

        return documents;
    },
};