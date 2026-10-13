import React from "react";
import { DbErrorToast } from "@/components/shared/db-error-toast";
import { useErrorStore } from "@/stores/use-error-store";

export function ToastHost() {
  const toast = useErrorStore((s) => s.toast);
  const dismiss = useErrorStore((s) => s.dismissToast);
  const run = useErrorStore((s) => s.runToastAction);
  return <DbErrorToast error={toast} onDismiss={dismiss} onAction={run} />;
}

// Rendered inside the root ErrorBoundary: a fatal set from non-React code is
// re-thrown during render, so the existing RootFallbackComponent shows.
export function FatalGate({ children }: { children: React.ReactNode }) {
  const fatal = useErrorStore((s) => s.fatal);
  if (fatal) throw fatal;
  return <>{children}</>;
}
