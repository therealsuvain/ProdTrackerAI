import { useSyncExternalStore } from "react";
import { useTimerStore } from "@/stores/use-timer-store";
import { getDisplaySeconds, msUntilNextDisplayChange } from "@/utils/Timer-utils/timer-math";

const listeners = new Set<() => void>();
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let storeUnsub: (() => void) | null = null;

function schedule() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    const s = useTimerStore.getState();
    if (listeners.size === 0 || !s.isRunning) return;
    timeoutId = setTimeout(() => {
        listeners.forEach((l) => l());
        schedule();
    }, msUntilNextDisplayChange(s, Date.now()) + 2);
}

export function kickTimerTicker() {
    listeners.forEach((l) => l());
    schedule();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    if (listeners.size === 1) {
        storeUnsub = useTimerStore.subscribe((s, p) => {
            if (s.isRunning !== p.isRunning || s.startedAt !== p.startedAt || s.accumulatedMs !== p.accumulatedMs ||
                s.mode !== p.mode || s.countdownTarget !== p.countdownTarget) schedule();
        });
        schedule();
    }
    const unsubStore = useTimerStore.subscribe(cb);
    return () => {
        unsubStore();
        listeners.delete(cb);
        if (listeners.size === 0) {
            storeUnsub?.();
            storeUnsub = null;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
}

const getSnapshot = () => getDisplaySeconds(useTimerStore.getState(), Date.now());

export const useTimerSeconds = (): number => useSyncExternalStore(subscribe, getSnapshot);