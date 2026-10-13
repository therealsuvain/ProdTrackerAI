export type TimerMode = "stopwatch" | "countdown";

export interface TimerCore {
    mode: TimerMode;
    countdownTarget: number; // seconds
    title: string;
    category: string;
    laps: number[]; // seconds
    isRunning: boolean;
    startedAt: number | null; // wall-clock ms the current running segment began
    accumulatedMs: number; // elapsed ms before the current segment
    sessionStartedAt: number | null; // wall-clock ms of the session's first start
}

export const getElapsedMs = (
    s: Pick<TimerCore, "isRunning" | "startedAt" | "accumulatedMs">,
    now: number,
): number =>
    s.accumulatedMs +
    (s.isRunning && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0);

export const getDisplaySeconds = (s: TimerCore, now: number): number => {
    const elapsed = getElapsedMs(s, now);
    return s.mode === "countdown"
        ? Math.max(0, Math.ceil((s.countdownTarget * 1000 - elapsed) / 1000))
        : Math.floor(elapsed / 1000);
};

export const msUntilNextDisplayChange = (s: TimerCore, now: number): number => {
    const elapsed = getElapsedMs(s, now);
    if (s.mode === "countdown") {
        const remaining = s.countdownTarget * 1000 - elapsed;
        return remaining > 0 ? remaining % 1000 || 1000 : 1000;
    }
    return 1000 - (elapsed % 1000);
};

export const hasSession = (s: Pick<TimerCore, "isRunning" | "accumulatedMs">) =>
    s.isRunning || s.accumulatedMs > 0;

export const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(" ");
};

/**
 * Formats a Date or ISO string to a relative time string for display.
 * Under 24h → relative ("2 hours ago", "just now").
 * Over 24h → short date ("Mar 19, 10:30 AM").
 */
export const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};