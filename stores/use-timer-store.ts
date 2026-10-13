import { create } from "zustand";
import { TimerCore } from "@/utils/Timer-utils/timer-math";
import { loadPersistedTimer } from "@/utils/Timer-utils/timer-persistence";

type TimerActions = {
    setTitle: (title: string) => void;
    setCategory: (category: string) => void;
    setCountdownTarget: (seconds: number) => void;
    toggleMode: () => void;
    begin: (now: number) => void;
    halt: (now: number) => void;
    addLap: (seconds: number) => void;
    freezeAt: (elapsedMs: number) => void;
    clearSession: () => void;
    restore: (state: Partial<TimerCore>) => void;
};

export const useTimerStore = create<TimerCore & TimerActions>((set) => ({
    ...loadPersistedTimer(),

    setTitle: (title) => set({ title }),
    setCategory: (category) => set({ category }),
    setCountdownTarget: (seconds) =>
        set((s) => {
            if (s.isRunning) return s;
            const min = Math.floor(s.accumulatedMs / 1000) + 1;
            return { countdownTarget: Math.max(min, Math.floor(seconds)) };
        }),
    toggleMode: () =>
        set((s) =>
            s.isRunning ? s : {
                mode: s.mode === "stopwatch" ? "countdown" : "stopwatch",
                accumulatedMs: 0, startedAt: null, sessionStartedAt: null, laps: [],
            },
        ),
    begin: (now) =>
        set((s) => (s.isRunning ? s : { isRunning: true, startedAt: now, sessionStartedAt: s.sessionStartedAt ?? now })),
    halt: (now) =>
        set((s) =>
            !s.isRunning || s.startedAt === null ? s : {
                isRunning: false, startedAt: null,
                accumulatedMs: s.accumulatedMs + Math.max(0, now - s.startedAt),
            },
        ),
    addLap: (seconds) => set((s) => ({ laps: [...s.laps, seconds] })),
    freezeAt: (elapsedMs) => set({ isRunning: false, startedAt: null, accumulatedMs: elapsedMs }),
    clearSession: () =>
        set({ title: "", category: "", laps: [], isRunning: false, startedAt: null, accumulatedMs: 0, sessionStartedAt: null }),
    restore: (state) => set(state),
}));