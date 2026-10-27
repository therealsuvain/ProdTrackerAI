import AsyncStorage from "@react-native-async-storage/async-storage";

export interface GlobalSearchEasterEggDiscovery {
    eggId: string;
    discoveredAt: string;
}

const STORAGE_KEY = "GLOBAL_SEARCH_EASTER_EGG_DISCOVERIES_V1";

let cachedDiscoveries: GlobalSearchEasterEggDiscovery[] | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function serializeOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(operation, operation);

    operationQueue = result.then(
        () => undefined,
        () => undefined,
    );

    return result;
}

async function readDiscoveriesUnlocked(): Promise<
    GlobalSearchEasterEggDiscovery[]
> {
    if (cachedDiscoveries) return cachedDiscoveries;

    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
        cachedDiscoveries = [];
        return cachedDiscoveries;
    }

    try {
        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            cachedDiscoveries = [];
            return cachedDiscoveries;
        }

        cachedDiscoveries = parsed.flatMap((entry) => {
            if (
                !entry ||
                typeof entry !== "object" ||
                typeof (entry as Record<string, unknown>).eggId !== "string" ||
                typeof (entry as Record<string, unknown>).discoveredAt !== "string"
            ) {
                return [];
            }

            // Rebuild the object so no extra properties can persist.
            return [{
                eggId: (entry as GlobalSearchEasterEggDiscovery).eggId,
                discoveredAt: (entry as GlobalSearchEasterEggDiscovery).discoveredAt,
            }];
        });

        return cachedDiscoveries;
    } catch {
        cachedDiscoveries = [];
        return cachedDiscoveries;
    }
}

export function getGlobalSearchEasterEggDiscoveries() {
    return serializeOperation(readDiscoveriesUnlocked);
}

/**
 * Stores a discovery only on the first successful record operation.
 * Repeated taps never change the original discoveredAt timestamp.
 */
export function recordGlobalSearchEasterEggDiscovery(
    eggId: string,
): Promise<boolean> {
    return serializeOperation(async () => {
        const existing = await readDiscoveriesUnlocked();

        if (existing.some((item) => item.eggId === eggId)) {
            return false;
        }

        const discovery: GlobalSearchEasterEggDiscovery = {
            eggId,
            discoveredAt: new Date().toISOString(),
        };

        const next = [...existing, discovery];

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        cachedDiscoveries = next;

        return true;
    });
}