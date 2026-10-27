import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchResult,
} from "@/types/global-search";

import { GLOBAL_SEARCH_EASTER_EGGS } from "./easter-egg-registry";
import { normalizeSearchText } from "./text-normalization";

const EASTER_EGG_PRESENTATION: Record<
    string,
    { icon: string; accentColor: string }
> = {
    rickroll: {
        icon: "youtube",
        accentColor: "#E53935",
    },
    launch_sequence: {
        icon: "rocket-launch-outline",
        accentColor: "#8A64D6",
    },
    answer_42: {
        icon: "help-circle-outline",
        accentColor: "#4FA7C9",
    },
    hello_there: {
        icon: "hand-wave-outline",
        accentColor: "#E4A849",
    },
    abracadabra: {
        icon: "magic-staff",
        accentColor: "#C16DCE",
    },
};

/**
 * Easter eggs only match when the entire normalized query equals an
 * approved trigger. No substring matching, token matching, or fuzzy
 * matching is used for these triggers.
 *
 * Case and ordinary punctuation differences are ignored by the shared
 * normalizer. For example, "Rickroll me!" matches "rickroll me", but
 * "142" and "420" do not match the trigger "42".
 */
export function matchGlobalSearchEasterEggs(
    rawQuery: string,
): GlobalSearchResult[] {
    const normalizedQuery = normalizeSearchText(rawQuery);

    if (!normalizedQuery) return [];

    const results: GlobalSearchResult[] = [];

    for (const egg of GLOBAL_SEARCH_EASTER_EGGS) {
        const matchedTrigger = egg.triggers.find(
            (trigger) => normalizeSearchText(trigger) === normalizedQuery,
        );

        if (!matchedTrigger) continue;

        const presentation = EASTER_EGG_PRESENTATION[egg.id] ?? {
            icon: "star-four-points-outline",
            accentColor: "#9B80D5",
        };

        const document: GlobalSearchDocument = {
            key: getGlobalSearchKey({
                kind: "easterEgg",
                eggId: egg.id,
            }),
            kind: "easterEgg",
            target: {
                kind: "easterEgg",
                eggId: egg.id,
            },
            display: {
                title: egg.title,
                subtitle: egg.subtitle ?? "A hidden search surprise",
                presentation: {
                    icon: {
                        family: "material-community",
                        name: presentation.icon,
                    },
                    accentColor: presentation.accentColor,
                },
            },
            fields: [],
        };

        results.push({
            document,
            match: {
                score: 1200,
                quality: "exact-trigger",
                field: "eggTrigger",
                matchedText: matchedTrigger,
            },
        });
    }

    return results;
}