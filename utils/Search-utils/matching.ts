import type {
    GlobalSearchDocument,
    GlobalSearchField,
    GlobalSearchFilters,
    GlobalSearchKind,
    GlobalSearchMatch,
    GlobalSearchMatchField,
    GlobalSearchMatchQuality,
    GlobalSearchResult,
} from "@/types/global-search";

import {
    normalizeSearchText,
    tokenizeSearchText,
} from "./text-normalization";

/**
 * These are ranking scores, not confidence percentages.
 * Higher scores mean a stronger match.
 */
export const GLOBAL_SEARCH_SCORES = {
    exactTitle: 1000,
    titlePrefix: 850,
    titlePhrase: 750,
    titleTokens: 650,
    fuzzyTitle: 500,
    description: 350,
    unlockedDescription: 300,
    metadata: 275,
    secondaryContext: 250,
} as const;

/**
 * Conservative, configurable fuzzy-matching defaults.
 *
 * Adjust these after testing against real queries and titles.
 * Short queries and short tokens never use fuzzy matching.
 */
export const GLOBAL_SEARCH_FUZZY_CONFIG = {
    enabled: true,
    minimumQueryLength: 3,
    minimumTokenLength: 3,

    // Similarity = 1 - (edit distance / longer token length).
    minimumSimilarityForShortTokens: 0.66,
    minimumSimilarityForMediumTokens: 0.72,
    minimumSimilarityForLongTokens: 0.78,

    maximumDistanceForShortTokens: 1,
    maximumDistanceForMediumTokens: 1,
    maximumDistanceForLongTokens: 2,
} as const;

interface RankedCandidate {
    result: GlobalSearchResult;
    fieldPriority: number;
    position: number;
}

interface TokenPosition {
    value: string;
    start: number;
}

/**
 * Finds the position of a complete word/phrase, rather than an accidental
 * substring inside another word.
 */
function findPhrasePosition(
    normalizedText: string,
    normalizedQuery: string,
): number {
    const paddedText = ` ${normalizedText} `;
    const paddedQuery = ` ${normalizedQuery} `;
    const index = paddedText.indexOf(paddedQuery);

    return index === -1 ? -1 : index + 1;
}

function getTokenPositions(normalizedText: string): TokenPosition[] {
    const tokens: TokenPosition[] = [];
    const expression = /\S+/g;

    let match: RegExpExecArray | null;

    while ((match = expression.exec(normalizedText)) !== null) {
        tokens.push({
            value: match[0],
            start: match.index,
        });
    }

    return tokens;
}

/**
 * Damerau-style optimal-string-alignment distance.
 * It counts adjacent character transpositions as one edit, so a typo such
 * as "desgin" can match "design".
 */
function editDistance(source: string, target: string): number {
    const rows = source.length + 1;
    const columns = target.length + 1;

    const distance: number[][] = Array.from(
        { length: rows },
        () => Array<number>(columns).fill(0),
    );

    for (let i = 0; i < rows; i++) {
        distance[i][0] = i;
    }

    for (let j = 0; j < columns; j++) {
        distance[0][j] = j;
    }

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < columns; j++) {
            const substitutionCost =
                source[i - 1] === target[j - 1] ? 0 : 1;

            distance[i][j] = Math.min(
                distance[i - 1][j] + 1,
                distance[i][j - 1] + 1,
                distance[i - 1][j - 1] + substitutionCost,
            );

            if (
                i > 1 &&
                j > 1 &&
                source[i - 1] === target[j - 2] &&
                source[i - 2] === target[j - 1]
            ) {
                distance[i][j] = Math.min(
                    distance[i][j],
                    distance[i - 2][j - 2] + 1,
                );
            }
        }
    }

    return distance[rows - 1][columns - 1];
}

function getFuzzyLimits(tokenLength: number): {
    maxDistance: number;
    minimumSimilarity: number;
} {
    if (tokenLength <= 4) {
        return {
            maxDistance:
                GLOBAL_SEARCH_FUZZY_CONFIG.maximumDistanceForShortTokens,
            minimumSimilarity:
                GLOBAL_SEARCH_FUZZY_CONFIG.minimumSimilarityForShortTokens,
        };
    }

    if (tokenLength <= 7) {
        return {
            maxDistance:
                GLOBAL_SEARCH_FUZZY_CONFIG.maximumDistanceForMediumTokens,
            minimumSimilarity:
                GLOBAL_SEARCH_FUZZY_CONFIG.minimumSimilarityForMediumTokens,
        };
    }

    return {
        maxDistance:
            GLOBAL_SEARCH_FUZZY_CONFIG.maximumDistanceForLongTokens,
        minimumSimilarity:
            GLOBAL_SEARCH_FUZZY_CONFIG.minimumSimilarityForLongTokens,
    };
}

function matchesAllTokens(
    haystackTokens: readonly string[],
    queryTokens: readonly string[],
): boolean {
    return queryTokens.every((token) => haystackTokens.includes(token));
}

function fuzzyTokensMatch(
    normalizedTitle: string,
    queryTokens: readonly string[],
): { matches: boolean; position: number } {
    if (!GLOBAL_SEARCH_FUZZY_CONFIG.enabled) {
        return { matches: false, position: Number.MAX_SAFE_INTEGER };
    }

    const normalizedQuery = queryTokens.join(" ");

    if (
        normalizedQuery.length <
        GLOBAL_SEARCH_FUZZY_CONFIG.minimumQueryLength ||
        queryTokens.length === 0 ||
        queryTokens.some(
            (token) =>
                token.length < GLOBAL_SEARCH_FUZZY_CONFIG.minimumTokenLength,
        )
    ) {
        return { matches: false, position: Number.MAX_SAFE_INTEGER };
    }

    const titleTokens = getTokenPositions(normalizedTitle);
    const usedTitleIndexes = new Set<number>();
    const matchedPositions: number[] = [];

    for (const queryToken of queryTokens) {
        // Prefer an exact token match before trying fuzzy matching.
        const exactIndex = titleTokens.findIndex(
            (token, index) =>
                !usedTitleIndexes.has(index) &&
                token.value === queryToken,
        );

        if (exactIndex !== -1) {
            usedTitleIndexes.add(exactIndex);
            matchedPositions.push(titleTokens[exactIndex].start);
            continue;
        }

        const limits = getFuzzyLimits(queryToken.length);
        let bestIndex = -1;
        let bestDistance = Number.MAX_SAFE_INTEGER;
        let bestSimilarity = -1;

        for (let index = 0; index < titleTokens.length; index++) {
            if (usedTitleIndexes.has(index)) continue;

            const titleToken = titleTokens[index].value;

            if (
                titleToken.length <
                GLOBAL_SEARCH_FUZZY_CONFIG.minimumTokenLength
            ) {
                continue;
            }

            const distance = editDistance(queryToken, titleToken);

            if (distance > limits.maxDistance) continue;

            const longestLength = Math.max(
                queryToken.length,
                titleToken.length,
            );

            const similarity =
                longestLength === 0 ? 1 : 1 - distance / longestLength;

            if (similarity < limits.minimumSimilarity) continue;

            if (
                similarity > bestSimilarity ||
                (similarity === bestSimilarity && distance < bestDistance)
            ) {
                bestIndex = index;
                bestDistance = distance;
                bestSimilarity = similarity;
            }
        }

        if (bestIndex === -1) {
            return { matches: false, position: Number.MAX_SAFE_INTEGER };
        }

        usedTitleIndexes.add(bestIndex);
        matchedPositions.push(titleTokens[bestIndex].start);
    }

    return {
        matches: true,
        position: Math.min(...matchedPositions),
    };
}

function getFieldPriority(field: GlobalSearchMatchField): number {
    switch (field) {
        case "title":
            return 0;
        case "description":
            return 1;
        case "tag":
            return 2;
        case "category":
            return 3;
        case "unlockedDescription":
            return 4;
        case "settingGroup":
            return 5;
        case "alias":
            return 6;
        case "eggTrigger":
            return 7;
    }
}

/* function createSnippet(value: string, maxLength = 120): string {
    const trimmed = value.trim();

    if (trimmed.length <= maxLength) return trimmed;

    return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
} */
function createSnippet(
    value: string,
    maxLength = 120,
    matchPosition = 0,
): string {
    if (value.length <= maxLength) return value.trim();

    // Place the match about one-third of the way into the visible snippet,
    // leaving more context after it than before it.
    const maxStart = value.length - maxLength;
    const preferredStart = Math.floor(
        matchPosition - maxLength / 3,
    );

    const start = Math.max(
        0,
        Math.min(maxStart, preferredStart),
    );

    const end = Math.min(value.length, start + maxLength);
    const content = value.slice(start, end).trim();

    return `${start > 0 ? "…" : ""}${content}${end < value.length ? "…" : ""
        }`;
}

function createCandidate(
    document: GlobalSearchDocument,
    score: number,
    quality: GlobalSearchMatchQuality,
    field: GlobalSearchMatchField,
    matchedText: string,
    position: number,
): RankedCandidate {
    const match: GlobalSearchMatch = {
        score,
        quality,
        field,
        matchedText,
        snippet: createSnippet(matchedText, 120, position),
    };

    return {
        result: { document, match },
        fieldPriority: getFieldPriority(field),
        position,
    };
}

function findTitleMatch(
    document: GlobalSearchDocument,
    query: string,
    queryTokens: readonly string[],
): RankedCandidate | null {
    const title = document.display.title;
    const normalizedTitle = normalizeSearchText(title);

    if (!normalizedTitle) return null;

    if (normalizedTitle === query) {
        return createCandidate(
            document,
            GLOBAL_SEARCH_SCORES.exactTitle,
            "exact-title",
            "title",
            title,
            0,
        );
    }

    if (normalizedTitle.startsWith(query)) {
        return createCandidate(
            document,
            GLOBAL_SEARCH_SCORES.titlePrefix,
            "title-prefix",
            "title",
            title,
            0,
        );
    }

    const phrasePosition = findPhrasePosition(normalizedTitle, query);

    if (phrasePosition !== -1) {
        return createCandidate(
            document,
            GLOBAL_SEARCH_SCORES.titlePhrase,
            "title-phrase",
            "title",
            title,
            phrasePosition,
        );
    }

    const titleTokens = tokenizeSearchText(normalizedTitle);
    const titleTokenPositions = getTokenPositions(normalizedTitle);

    if (matchesAllTokens(titleTokens, queryTokens)) {
        const position = Math.min(
            ...queryTokens.map(
                (token) =>
                    titleTokenPositions.find((entry) => entry.value === token)
                        ?.start ?? Number.MAX_SAFE_INTEGER,
            ),
        );

        return createCandidate(
            document,
            GLOBAL_SEARCH_SCORES.titleTokens,
            "title-token",
            "title",
            title,
            position,
        );
    }

    const fuzzyMatch = fuzzyTokensMatch(normalizedTitle, queryTokens);

    if (fuzzyMatch.matches) {
        return createCandidate(
            document,
            GLOBAL_SEARCH_SCORES.fuzzyTitle,
            "fuzzy-title",
            "title",
            title,
            fuzzyMatch.position,
        );
    }

    return null;
}

function findFieldMatch(
    document: GlobalSearchDocument,
    field: GlobalSearchField,
    query: string,
    queryTokens: readonly string[],
): RankedCandidate | null {
    const normalizedValue = normalizeSearchText(field.value);

    if (!normalizedValue) return null;

    const phrasePosition = findPhrasePosition(normalizedValue, query);
    const tokens = tokenizeSearchText(normalizedValue);

    // Only a complete phrase or all query tokens qualifies.
    if (
        phrasePosition === -1 &&
        !matchesAllTokens(tokens, queryTokens)
    ) {
        return null;
    }

    let score: number;
    let quality: GlobalSearchMatchQuality;

    switch (field.kind) {
        case "description":
            score = GLOBAL_SEARCH_SCORES.description;
            quality = "description";
            break;

        case "unlockedDescription":
            // Providers must omit this field from locked achievements.
            score = GLOBAL_SEARCH_SCORES.unlockedDescription;
            quality = "unlocked-description";
            break;

        case "tag":
        case "category":
            score = GLOBAL_SEARCH_SCORES.metadata;
            quality = "metadata";
            break;

        case "settingGroup":
        case "alias":
            score = GLOBAL_SEARCH_SCORES.secondaryContext;
            quality = "secondary-context";
            break;
    }

    return createCandidate(
        document,
        score,
        quality,
        field.kind,
        field.value,
        phrasePosition !== -1
            ? phrasePosition
            : Math.min(
                ...queryTokens.map((token) => getTokenPositions(normalizedValue).find(
                    (entry) => entry.value === token,
                )?.start ?? Number.MAX_SAFE_INTEGER,),
            ),
    );
}

function isBetterCandidate(
    candidate: RankedCandidate,
    current: RankedCandidate | null,
): boolean {
    if (!current) return true;

    if (candidate.result.match.score !== current.result.match.score) {
        return candidate.result.match.score > current.result.match.score;
    }

    if (candidate.fieldPriority !== current.fieldPriority) {
        return candidate.fieldPriority < current.fieldPriority;
    }

    return candidate.position < current.position;
}

function findBestDocumentMatch(
    document: GlobalSearchDocument,
    query: string,
    queryTokens: readonly string[],
): RankedCandidate | null {
    // Easter eggs have their own exact-trigger activation path.
    // They must never enter ordinary or fuzzy matching.
    if (document.kind === "easterEgg") return null;

    let best = findTitleMatch(document, query, queryTokens);

    for (const field of document.fields) {
        const candidate = findFieldMatch(
            document,
            field,
            query,
            queryTokens,
        );

        if (candidate && isBetterCandidate(candidate, best)) {
            best = candidate;
        }
    }

    return best;
}

/**
 * Applies type/category/tag filters before text matching.
 *
 * Selected categories are ORed together.
 * Selected tags follow the configured "all" or "any" behavior.
 * Type, category, and tag dimensions combine with AND.
 */
function supportsTaxonomyFilters(
    document: GlobalSearchDocument,
): boolean {
    return (
        document.kind === "task" ||
        document.kind === "event" ||
        document.kind === "habit" ||
        document.kind === "log"
    );
}

export function filterGlobalSearchDocuments(
    documents: readonly GlobalSearchDocument[],
    filters: GlobalSearchFilters,
): GlobalSearchDocument[] {
    return documents.filter((document) => {
        // Type filters apply to every standard searchable kind.
        if (
            filters.type !== "all" &&
            document.kind !== filters.type
        ) {
            return false;
        }

        // Taxonomy facets do not apply to document types that don't have
        // attached category/tag IDs, such as tags, categories, or achievements.
        if (!supportsTaxonomyFilters(document)) {
            return true;
        }

        const categoryIds = document.facets?.categoryIds ?? [];
        const tagIds = document.facets?.tagIds ?? [];

        // Multiple selected categories mean any selected category.
        if (
            filters.categoryIds.length > 0 &&
            !filters.categoryIds.some((id) => categoryIds.includes(id))
        ) {
            return false;
        }

        // Tag behavior depends on the user's All/Any selection.
        if (filters.tagIds.length > 0) {
            const matchesTags =
                filters.tagMatchMode === "all"
                    ? filters.tagIds.every((id) => tagIds.includes(id))
                    : filters.tagIds.some((id) => tagIds.includes(id));

            if (!matchesTags) return false;
        }

        return true;
    });
}

/**
 * Searches and ranks a filtered document set.
 *
 * Returns one result per document, using that document's strongest match.
 * An empty query returns no text-ranked results; filter-only browsing can
 * be handled separately by the UI pipeline.
 */
export function searchGlobalDocuments(
    documents: readonly GlobalSearchDocument[],
    rawQuery: string,
    filters: GlobalSearchFilters,
): GlobalSearchResult[] {
    const query = normalizeSearchText(rawQuery);

    const filteredDocuments = filterGlobalSearchDocuments(
        documents,
        filters,
    );

    if (!query) {
        const hasTaxonomyFilters =
            filters.categoryIds.length > 0 ||
            filters.tagIds.length > 0;

        const hasAnyFilters =
            filters.type !== "all" || hasTaxonomyFilters;

        // Preserve the existing initial empty state when nothing is selected.
        if (!hasAnyFilters) return [];

        // Without a text query, taxonomy-only browsing shows the records
        // to which those facets actually apply. Other types become eligible
        // when the user enters a query and they match that text.
        const browseDocuments = filteredDocuments.filter((document) => {
            if (document.kind === "easterEgg") return false;

            return (
                !hasTaxonomyFilters ||
                supportsTaxonomyFilters(document)
            );
        });

        const kindOrder: Partial<Record<GlobalSearchKind, number>> = {
            task: 0,
            event: 1,
            habit: 2,
            log: 3,
            tag: 4,
            category: 5,
            achievement: 6,
            setting: 7,
            chart: 8,
            action: 9,
            easterEgg: 10,
        };

        return browseDocuments
            .slice()
            .sort((a, b) => {
                const orderA = kindOrder[a.kind] ?? 99;
                const orderB = kindOrder[b.kind] ?? 99;

                if (orderA !== orderB) return orderA - orderB;

                const titleA = normalizeSearchText(a.display.title);
                const titleB = normalizeSearchText(b.display.title);

                if (titleA !== titleB) {
                    return titleA < titleB ? -1 : 1;
                }

                return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
            })
            .map((document) => ({
                document,
                match: {
                    score: 0,
                    quality: "filter-only" as const,
                    field: "title" as const,
                    matchedText: document.display.title,
                },
            }));
    }

    const queryTokens = tokenizeSearchText(query);
    const ranked: RankedCandidate[] = [];

    for (const document of filteredDocuments) {
        const candidate = findBestDocumentMatch(
            document,
            query,
            queryTokens,
        );

        if (candidate) ranked.push(candidate);
    }

    ranked.sort((a, b) => {
        if (a.result.match.score !== b.result.match.score) {
            return b.result.match.score - a.result.match.score;
        }

        if (a.fieldPriority !== b.fieldPriority) {
            return a.fieldPriority - b.fieldPriority;
        }

        if (a.position !== b.position) {
            return a.position - b.position;
        }

        const keyA = a.result.document.key;
        const keyB = b.result.document.key;

        return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

    return ranked.map((candidate) => candidate.result);
}