import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
    type GlobalSearchProviderContext,
    type GlobalSearchProviderId,
} from "@/types/global-search";

import {
    recordGlobalSearchCatalogueBuild,
    recordGlobalSearchProviderBuild,
    startGlobalSearchTimer,
} from "@/utils/Search-utils/diagnostics/search-diagnostics";

export interface RegisteredGlobalSearchProvider {
    readonly id: GlobalSearchProviderId;

    buildDocuments(
        context: GlobalSearchProviderContext,
    ): readonly GlobalSearchDocument[];
}

/**
 * Binds a typed provider to a source getter so providers with
 * different source types can be held in one registry.
 *
 * The getter should return the current source data, not a stale
 * snapshot retained when the provider was first created.
 */
export function bindGlobalSearchProvider<TSource>(
    provider: GlobalSearchProvider<TSource>,
    getSource: () => TSource,
): RegisteredGlobalSearchProvider {
    return {
        id: provider.id,

        buildDocuments(context) {
            return provider.buildDocuments(getSource(), context);
        },
    };
}

/**
 * Creates a registry and rejects duplicate provider IDs.
 */
export function createGlobalSearchProviderRegistry(
    providers: readonly RegisteredGlobalSearchProvider[],
): ReadonlyMap<GlobalSearchProviderId, RegisteredGlobalSearchProvider> {
    const registry = new Map<
        GlobalSearchProviderId,
        RegisteredGlobalSearchProvider
    >();

    for (const provider of providers) {
        if (registry.has(provider.id)) {
            throw new Error(
                `Duplicate global search provider: "${provider.id}"`,
            );
        }

        registry.set(provider.id, provider);
    }

    return registry;
}

/**
 * Builds a catalogue from the currently registered providers.
 * Source stores and registries remain the source of truth.
 */
export function buildGlobalSearchCatalogue(
    registry: ReadonlyMap<
        GlobalSearchProviderId,
        RegisteredGlobalSearchProvider
    >,
    context: GlobalSearchProviderContext,
): readonly GlobalSearchDocument[] {

    const catalogueStartedAt = startGlobalSearchTimer();
    const documents: GlobalSearchDocument[] = [];
    const seenKeys = new Set<string>();
    try {
        for (const [providerId, provider] of registry) {
            //!TEST ONLY CODE COMMENT REMOVE AFTER TEST ONLY CODE REMOVED
            //const providerDocuments = provider.buildDocuments(context);

            //!TEST ONLY CODE START
            const providerStartedAt = startGlobalSearchTimer();
            let providerDocuments: readonly GlobalSearchDocument[] = [];

            try {
                providerDocuments = provider.buildDocuments(context);
            } finally {
                recordGlobalSearchProviderBuild(
                    providerId,
                    providerStartedAt,
                    providerDocuments.length,
                );
            }
            //!TEST ONLY CODE END
            for (const document of providerDocuments) {
                if (document.kind !== providerId) {
                    throw new Error(
                        `Provider "${providerId}" returned a document of kind "${document.kind}"`,
                    );
                }

                const expectedKey = getGlobalSearchKey(document.target);

                if (document.key !== expectedKey) {
                    throw new Error(
                        `Invalid search key "${document.key}". Expected "${expectedKey}"`,
                    );
                }

                if (seenKeys.has(document.key)) {
                    throw new Error(
                        `Duplicate global search document: "${document.key}"`,
                    );
                }

                seenKeys.add(document.key);
                documents.push(document);
            }
        }

        return documents;
    } finally {
        recordGlobalSearchCatalogueBuild(
            catalogueStartedAt,
            documents.length,
        );
    }
}