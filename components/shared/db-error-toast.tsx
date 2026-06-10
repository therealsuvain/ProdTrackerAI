import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";

// ─── hook ─────────────────────────────────────────────────────────────────────
//Note Undo Vairant has been added, not tested, not being used naywhere tho.
interface ToastState {
  message: string;
  visible: boolean;
  title?: string;
  variant?: "error" | "undo";
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export function useDbErrorToast() {
  const [toastError, setToastError] = useState<ToastState>({
    message: "",
    visible: false,
    title: "Save failed",
    variant: "error",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    // Clear any existing timer so multiple rapid errors don't overlap
    clearTimer();

    setToastError({ message, visible: true });

    timerRef.current = setTimeout(() => {
      setToastError((prev) => ({ ...prev, visible: false }));
    }, 6000);
  }, []);

  const showUndoToast = useCallback(
    (
      message: string,
      onUndo: () => void | Promise<void>,
      title = "Deleted",
    ) => {
      clearTimer();

      setToastError({
        message,
        visible: true,
        title,
        variant: "undo",
        actionLabel: "Undo",
        onAction: onUndo,
      });

      timerRef.current = setTimeout(() => {
        setToastError((prev) => ({
          ...prev,
          visible: false,
          onAction: undefined,
        }));
      }, 10000);
    },
    [],
  );

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastError((prev) => ({ ...prev, visible: false }));
  }, []);

  const runAction = useCallback(async () => {
    const action = toastError.onAction;
    clearTimer();

    try {
      await action?.();
    } finally {
      setToastError((prev) => ({
        ...prev,
        visible: false,
        onAction: undefined,
      }));
    }
  }, [toastError.onAction]);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return { toastError, showToast, showUndoToast, dismissToast, runAction };
}

// ─── component ────────────────────────────────────────────────────────────────

interface DbErrorToastProps {
  error: ToastState;
  onDismiss?: () => void;
  onAction?: () => void;
}

export function DbErrorToast({ error, onDismiss }: DbErrorToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isUndo = error.variant === "undo";
  const borderColor = isUndo ? "#6AA84F" : "#E05252";

  useEffect(() => {
    if (error.visible) {
      // Slide up + fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down + fade out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error.visible]);

  // Always render so animation state is preserved — visibility via opacity
  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
        // Prevent interaction when invisible
        !error.visible && styles.hidden,
      ]}
      pointerEvents={error.visible ? "auto" : "none"}
    >
      <View style={[styles.toast, { borderColor }]}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{isUndo ? "↺" : "⚠"}</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {error.title ?? (isUndo ? "Deleted" : "Save failed")}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {error.message}
          </Text>
        </View>
        {isUndo && error.actionLabel ? (
          <TouchableOpacity onPress={error.onAction} style={styles.dismissButton}>
            <Text style={styles.dismissText}>{error.actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 80, // above tab bar
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  hidden: {
    // keeps it out of the accessibility tree when invisible
    pointerEvents: "none",
  } as any,
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E05252",
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3D1A1A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    fontSize: 14,
    color: "#E05252",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  message: {
    color: "#8A8A8A",
    fontSize: 12,
    lineHeight: 16,
  },
  dismissButton: {
    flexShrink: 0,
    padding: 2,
  },
  dismissText: {
    color: "#8A8A8A",
    fontSize: 13,
    fontWeight: "600",
  },
});
