/**
 * Normalizes text consistently for global search.
 *
 * Examples:
 *   "  Deep   Work "  -> "deep work"
 *   "Task—Planning"   -> "task planning"
 *   "DON'T STOP"      -> "dont stop"
 *
 * Keep this deterministic and independent of the user's locale.
 */
export function normalizeSearchText(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        // Normalize apostrophe variants by joining contractions/possessives.
        .replace(/['’‘`´]/g, "")
        // Treat common dash variants as word separators.
        .replace(/[\u2010-\u2015\u2212]/g, " ")
        // Keep letters and numbers from any Unicode script.
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function tokenizeSearchText(value: string): string[] {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(" ") : [];
}