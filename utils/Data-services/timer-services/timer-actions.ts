import { randomUUID } from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Alert, AppState } from "react-native";

import {
    addTimerActionListener, showNotification, stopNativeTimer,
} from "@/modules/notifications-timer";
import { reportError } from "@/stores/use-error-store";
import { useTimerStore } from "@/stores/use-timer-store";
import { TimerLog } from "@/types/timer";
import { addLogWithEffects } from "@/utils/Data-services/timerlog-services/log-actions";
import { getElapsedMs, hasSession } from "@/utils/Timer-utils/timer-math";
import { persistTimer } from "@/utils/Timer-utils/timer-persistence";
import { kickTimerTicker } from "@/hooks/context-hooks/use-timer-seconds";

const END_NOTIFICATION_ID = "timer-countdown-end";
const getState = () => useTimerStore.getState();

let countdownTimeout: ReturnType<typeof setTimeout> | null = null;
let completing = false;
let permissionAsked = false;
let bridgeStarted = false;

// ── notification helpers ─────────────────────────────────────────────────────

async function ensureNotificationPermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain || permissionAsked) return false;
    permissionAsked = true;
    return (await Notifications.requestPermissionsAsync()).granted;
}

// Native contract (unchanged): always send ELAPSED time, so running and paused agree.
function syncNotification(): void {
    if (completing) return;
    const s = getState();
    try {
        if (!hasSession(s)) { stopNativeTimer(); return; }
        const now = Date.now();
        const elapsedMs = getElapsedMs(s, now);
        showNotification(s.title || "Timer", now - elapsedMs, s.isRunning, elapsedMs / 1000);
    } catch (error) {
        reportError(error, { severity: "silent", source: "timer-notification" });
    }
}

async function scheduleCountdownEndNotification(endMs: number, title: string) {
    try {
        // +1.5s so the in-app handler cancels it first when the app is in the foreground
        await Notifications.scheduleNotificationAsync({
            identifier: END_NOTIFICATION_ID,
            content: { title: "⏱ Time's up!", body: `"${title || "Timer"}" has ended.` },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endMs + 1500) },
        });
    } catch (error) {
        reportError(error, { severity: "silent", source: "timer-end-notification" });
    }
}
const cancelCountdownEndNotification = () =>
    Notifications.cancelScheduledNotificationAsync(END_NOTIFICATION_ID).catch(() => { });

// ── countdown ────────────────────────────────────────────────────────────────

function clearCountdownTimeout() {
    if (countdownTimeout) clearTimeout(countdownTimeout);
    countdownTimeout = null;
}

function scheduleCountdownEnd() {
    clearCountdownTimeout();
    const s = getState();
    if (s.mode !== "countdown" || !s.isRunning) return;
    const remaining = s.countdownTarget * 1000 - getElapsedMs(s, Date.now());
    countdownTimeout = setTimeout(() => void handleCountdownComplete(), Math.max(0, remaining));
    void scheduleCountdownEndNotification(Date.now() + Math.max(0, remaining), s.title);
}

async function handleCountdownComplete(): Promise<void> {
    // In background, leave the session running; reconcile on foreground completes it.
    if (completing || AppState.currentState !== "active") return;
    const s = getState();
    if (s.mode !== "countdown" || !s.isRunning || s.startedAt === null) return;

    completing = true;
    clearCountdownTimeout();
    void cancelCountdownEndNotification();
    const targetMs = s.countdownTarget * 1000;
    const endMs = s.startedAt + (targetMs - s.accumulatedMs); // the true instant it hit zero
    const snapshot = { title: s.title, category: s.category, laps: s.laps };
    getState().freezeAt(targetMs);
    try { stopNativeTimer(); } catch { }

    Alert.alert(
        "⏱ Time's Up!",
        `"${snapshot.title || "Timer"}" has ended. Would you like to save this session?`,
        [
            {
                text: "Save Session",
                onPress: async () => {
                    try {
                        await addLogWithEffects(buildLog(snapshot, s.countdownTarget, endMs, false));
                        getState().clearSession();
                    } catch (error) {
                        reportError(error, { userMessage: "Couldn't save the session. It's still on the timer.", source: "timer-save" });
                    } finally {
                        completing = false;
                    }
                },
            },
            { text: "Discard", style: "destructive", onPress: () => { getState().clearSession(); completing = false; } },
        ],
        { cancelable: false },
    );
}

// ── sessions ─────────────────────────────────────────────────────────────────

type Snapshot = { title: string; category: string; laps: number[] };

function buildLog(snap: Snapshot, durationSec: number, endMs: number, isPartial: boolean): TimerLog {
    const nowIso = new Date().toISOString();
    return {
        id: randomUUID(),
        title: snap.title || "Untitled Activity",
        category: snap.category.trim() || undefined,
        startTime: new Date(endMs - durationSec * 1000).toISOString(),
        endTime: new Date(endMs).toISOString(),
        duration: durationSec,
        createdAt: nowIso,
        updatedAt: nowIso,
        laps: snap.laps.length > 0 ? snap.laps : undefined,
        ...(isPartial ? { isPartial: true } : {}),
    };
}

function teardownSession() {
    clearCountdownTimeout();
    void cancelCountdownEndNotification();
    getState().clearSession();
    try { stopNativeTimer(); } catch { }
}

async function finishSession(isPartial: boolean): Promise<TimerLog | null> {
    if (completing) return null;
    const now = Date.now();
    const s = getState();
    const elapsedMs = getElapsedMs(s, now);
    const durationSec = Math.floor(elapsedMs / 1000);
    const snapshot: Snapshot = { title: s.title, category: s.category, laps: s.laps };
    const sessionStartedAt = s.sessionStartedAt;

    teardownSession(); // UI resets immediately; a second Stop sees an idle timer and does nothing
    if (durationSec <= 0) return null;

    const log = buildLog(snapshot, durationSec, now, isPartial);
    try {
        await addLogWithEffects(log);
        return log;
    } catch (error) {
        getState().restore({ ...snapshot, isRunning: false, startedAt: null, accumulatedMs: elapsedMs, sessionStartedAt });
        syncNotification();
        reportError(error, { userMessage: "Couldn't save your session. It's still on the timer.", source: "timer-save" });
        return null;
    }
}

// ── public actions ───────────────────────────────────────────────────────────

export function startTimerWithEffects(): void {
    if (completing || getState().isRunning) return;
    getState().begin(Date.now());
    scheduleCountdownEnd();
    void ensureNotificationPermission().finally(syncNotification);
}

export function pauseTimerWithEffects(): void {
    if (!getState().isRunning) return;
    getState().halt(Date.now());
    clearCountdownTimeout();
    void cancelCountdownEndNotification();
    syncNotification();
}

export const stopTimerWithEffects = () => finishSession(false);
export const saveAndResetTimerWithEffects = () => finishSession(true);
export const discardTimerWithEffects = () => teardownSession();

export function requestResetTimer(): void {
    if (getElapsedMs(getState(), Date.now()) < 1000) { teardownSession(); return; }
    Alert.alert("Reset Timer", "What would you like to do with the current session?", [
        { text: "Save & Reset", onPress: () => void saveAndResetTimerWithEffects() },
        { text: "Discard", style: "destructive", onPress: () => teardownSession() },
        { text: "Cancel", style: "cancel" },
    ]);
}

export function lapTimerWithEffects(): void {
    const s = getState();
    if (!s.isRunning || s.mode === "countdown") return;
    s.addLap(Math.floor(getElapsedMs(s, Date.now()) / 1000)); // from the clock, not a rendered value
}

export function toggleTimerModeWithEffects(): void {
    if (getState().isRunning) return;
    getState().toggleMode();
    syncNotification();
}

export const setTimerTitle = (t: string) => getState().setTitle(t);
export const setTimerCategory = (c: string) => getState().setCategory(c);
export const setTimerCountdownTarget = (s: number) => getState().setCountdownTarget(s);

// ── bridge: call once after hydrateLocalWorkspace() ──────────────────────────

function reconcileTimer() {
    const s = getState();
    if (s.mode === "countdown" && s.isRunning && getElapsedMs(s, Date.now()) >= s.countdownTarget * 1000) {
        void handleCountdownComplete();
        return;
    }
    scheduleCountdownEnd();
    syncNotification(); // also clears a ghost notification when the timer is idle
    kickTimerTicker();
}

export function initTimerBridge(): void {
    if (bridgeStarted) return;
    bridgeStarted = true;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    useTimerStore.subscribe((s, p) => {
        const structural =
            s.isRunning !== p.isRunning || s.startedAt !== p.startedAt || s.accumulatedMs !== p.accumulatedMs ||
            s.sessionStartedAt !== p.sessionStartedAt || s.mode !== p.mode ||
            s.countdownTarget !== p.countdownTarget || s.laps !== p.laps;
        if (structural) {
            if (debounce) clearTimeout(debounce);
            debounce = null;
            persistTimer(s);
        } else if (s.title !== p.title || s.category !== p.category) {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => persistTimer(getState()), 400);
        }
    });

    addTimerActionListener(
        () => pauseTimerWithEffects(),
        () => startTimerWithEffects(),
        () => void stopTimerWithEffects(),
    );

    AppState.addEventListener("change", (next) => {
        if (next === "active") reconcileTimer();
        else persistTimer(getState());
    });

    reconcileTimer();
}