import { create } from "zustand";

export type ErrorSeverity = "silent" | "warning" | "fatal";

export type ToastState = {
    message: string;
    visible: boolean;
    title?: string;
    variant?: "error" | "undo";
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
};

type ErrorStore = {
    toast: ToastState;
    fatal: Error | null;
    showToast: (message: string, title?: string) => void;
    showUndoToast: (message: string, onUndo: () => void | Promise<void>, title?: string) => void;
    dismissToast: () => void;
    runToastAction: () => Promise<void>;
    setFatal: (e: Error) => void;
    clearFatal: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };

export const useErrorStore = create<ErrorStore>((set, get) => ({
    toast: { message: "", visible: false, title: "Save failed", variant: "error" },
    fatal: null,

    showToast: (message, title = "Save failed") => {
        clearTimer();
        set({ toast: { message, title, visible: true, variant: "error" } });
        timer = setTimeout(() => get().dismissToast(), 6000);
    },
    showUndoToast: (message, onUndo, title = "Deleted") => {
        clearTimer();
        set({ toast: { message, title, visible: true, variant: "undo", actionLabel: "Undo", onAction: onUndo } });
        timer = setTimeout(() => get().dismissToast(), 10000);
    },
    dismissToast: () => {
        clearTimer();
        set((s) => ({ toast: { ...s.toast, visible: false, onAction: undefined } }));
    },
    runToastAction: async () => {
        const action = get().toast.onAction;
        get().dismissToast();
        await action?.();
    },
    setFatal: (fatal) => set({ fatal }),
    clearFatal: () => set({ fatal: null }),
}));

export const showToast = (m: string, title?: string) => useErrorStore.getState().showToast(m, title);
export const showUndoToast = (m: string, onUndo: () => void | Promise<void>, t?: string) =>
    useErrorStore.getState().showUndoToast(m, onUndo, t);

export function toUserMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const unique = msg.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
    if (unique) return `A ${unique[1].replace(/s$/, "")} with that ${unique[2]} already exists.`;
    return "Something went wrong. Please try again.";
}

export function reportError(
    err: unknown,
    opts: { severity?: ErrorSeverity; userMessage?: string; source?: string } = {},
) {
    const { severity = "warning", userMessage, source = "app" } = opts;
    console.error(`[${source}]`, err);
    // TODO crash reporter: Sentry.captureException(err, { tags: { source, severity } })
    if (severity === "fatal") {
        useErrorStore.getState().setFatal(err instanceof Error ? err : new Error(String(err)));
    } else if (severity === "warning") {
        showToast(userMessage ?? toUserMessage(err));
    }
}

// Same signature as the old DataContext function: AuthContext only changes its import.
export const dispatchError = (err: Error | string, type: "warning" | "fatal" = "warning") =>
    reportError(typeof err === "string" ? new Error(err) : err, {
        severity: type,
        userMessage: typeof err === "string" ? err : undefined,
        source: "legacy-dispatchError",
    });