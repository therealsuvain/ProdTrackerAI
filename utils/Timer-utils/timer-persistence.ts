import storageMMKV from "@/utils/Storage-Utils/mmkv-instance";
import { STORAGE_KEYS } from "@/utils/Storage-Utils/storage-keys";
import { TimerCore } from "./timer-math";

const DEFAULT_TIMER: TimerCore = {
    mode: "stopwatch", countdownTarget: 300, title: "", category: "", laps: [],
    isRunning: false, startedAt: null, accumulatedMs: 0, sessionStartedAt: null,
};
const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function loadPersistedTimer(): TimerCore {
    try {
        const json = storageMMKV.getString(STORAGE_KEYS.TIMER);
        if (!json) return { ...DEFAULT_TIMER };
        const d = JSON.parse(json);
        const isV2 = d?.version === 2;
        const startedAt = isV2 ? d.startedAt : d.startTimestamp; // legacy shape has startTimestamp
        const isRunning = !!d.isRunning && typeof startedAt === "number";
        const target = num(d.countdownTarget, 300);
        return {
            mode: d.mode === "countdown" ? "countdown" : "stopwatch",
            countdownTarget: target > 0 ? target : 300,
            title: typeof d.title === "string" ? d.title : "",
            category: typeof d.category === "string" ? d.category : "",
            laps: Array.isArray(d.laps) ? d.laps.filter((n: unknown): n is number => typeof n === "number") : [],
            isRunning,
            startedAt: isRunning ? startedAt : null,
            accumulatedMs: Math.max(0, isV2 ? num(d.accumulatedMs, 0) : num(d.pausedSeconds, 0) * 1000),
            sessionStartedAt: isV2 ? (typeof d.sessionStartedAt === "number" ? d.sessionStartedAt : null) : isRunning ? startedAt : null,
        };
    } catch {
        return { ...DEFAULT_TIMER };
    }
}

export function persistTimer(s: TimerCore): void {
    try {
        storageMMKV.set(STORAGE_KEYS.TIMER, JSON.stringify({
            version: 2, mode: s.mode, countdownTarget: s.countdownTarget, title: s.title,
            category: s.category, laps: s.laps, isRunning: s.isRunning, startedAt: s.startedAt,
            accumulatedMs: s.accumulatedMs, sessionStartedAt: s.sessionStartedAt,
        }));
    } catch (error) {
        console.error("Failed to save timer data:", error);
    }
}