import { reportError } from "@/stores/use-error-store";

export function installGlobalErrorHandlers(): void {
    const g = globalThis as any;
    if (g.__errorHandlersInstalled) return;
    g.__errorHandlersInstalled = true;

    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
        reportError(error, { severity: isFatal ? "fatal" : "warning", source: "global-handler" });
        if (__DEV__) previous?.(error, isFatal); // keep the dev red box
    });
}