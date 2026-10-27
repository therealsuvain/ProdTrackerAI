import type { GlobalSearchProviderId } from "@/types/global-search";

const ENABLED = typeof __DEV__ !== "undefined" && __DEV__;

export interface ProviderDiagnostic {
  durationMs: number;
  documentCount: number;
}

export interface SearchDiagnosticsSnapshot {
  enabled: boolean;

  catalogueBuildCount: number;
  lastCatalogueBuildMs: number;
  lastCatalogueSize: number;

  providerTimings: Partial<
    Record<GlobalSearchProviderId | "actions", ProviderDiagnostic>
  >;

  lastMatchingDurationMs: number;
  lastQueryLength: number;
  lastResultCount: number;
  lastFuzzyComparisons: number;

  catalogueUpdateCount: number;
  lastCatalogueUpdateSize: number;
}

const snapshot: SearchDiagnosticsSnapshot = {
  enabled: ENABLED,

  catalogueBuildCount: 0,
  lastCatalogueBuildMs: 0,
  lastCatalogueSize: 0,

  providerTimings: {},

  lastMatchingDurationMs: 0,
  lastQueryLength: 0,
  lastResultCount: 0,
  lastFuzzyComparisons: 0,

  catalogueUpdateCount: 0,
  lastCatalogueUpdateSize: 0,
};

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/** Start a timer. In production this returns 0 and records nothing. */
export function startGlobalSearchTimer(): number {
  return ENABLED ? now() : 0;
}

export function recordGlobalSearchProviderBuild(
  providerId: GlobalSearchProviderId | "actions",
  startedAt: number,
  documentCount: number,
): void {
  if (!ENABLED) return;

  snapshot.providerTimings[providerId] = {
    durationMs: Math.max(0, now() - startedAt),
    documentCount,
  };
}

export function recordGlobalSearchCatalogueBuild(
  startedAt: number,
  documentCount: number,
): void {
  if (!ENABLED) return;

  snapshot.catalogueBuildCount += 1;
  snapshot.lastCatalogueBuildMs = Math.max(0, now() - startedAt);
  snapshot.lastCatalogueSize = documentCount;

  // For this implementation, catalogue rebuilding is the relevant
  // index-update operation; we do not have a separate inverted index.
  snapshot.catalogueUpdateCount += 1;
  snapshot.lastCatalogueUpdateSize = documentCount;
}

export function beginGlobalSearchMatching(queryLength: number): number {
  if (!ENABLED) return 0;

  snapshot.lastQueryLength = queryLength;
  snapshot.lastFuzzyComparisons = 0;

  return now();
}

export function recordGlobalSearchFuzzyComparison(count = 1): void {
  if (!ENABLED) return;

  snapshot.lastFuzzyComparisons += count;
}

export function finishGlobalSearchMatching(
  startedAt: number,
  resultCount: number,
): void {
  if (!ENABLED) return;

  snapshot.lastMatchingDurationMs = Math.max(0, now() - startedAt);
  snapshot.lastResultCount = resultCount;
  if (logAfterEachSearch) {
    logGlobalSearchDiagnostics();
  }
}

/** Return a detached snapshot so callers cannot mutate the counters. */
export function getGlobalSearchDiagnosticsSnapshot(): SearchDiagnosticsSnapshot {
  return {
    ...snapshot,
    providerTimings: { ...snapshot.providerTimings },
  };
}

/** Call manually when you want to inspect the latest measurements. */
export function logGlobalSearchDiagnostics(): void {
  if (!ENABLED) return;

  console.log(
    "[Global Search Diagnostics]",
    getGlobalSearchDiagnosticsSnapshot(),
  );
}

export function recordGlobalSearchCatalogueFinalized(
  documentCount: number,
): void {
  if (!ENABLED) return;

  // Includes separately appended action documents.
  snapshot.lastCatalogueSize = documentCount;
  snapshot.lastCatalogueUpdateSize = documentCount;
}

let logAfterEachSearch = false;

export function setGlobalSearchDiagnosticsLogging(
  enabled: boolean,
): void {
  if (!ENABLED) return;
  logAfterEachSearch = enabled;
}