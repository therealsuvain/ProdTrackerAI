/**
 * components/ui/db-error-toast.tsx
 *
 * Standalone toast for DB write failures. Rendered inside whatever screen
 * triggered the mutation. Invisible until an error occurs, auto-dismisses
 * after 4 seconds, dismissable by tap.
 *
 * Usage
 * ─────
 *  const { toastError, showToast } = useDbErrorToast();
 *
 *   In your mutation handler:
 *  try {
 *    await taskRepository.updateTask(updated);
 *  } catch (e) {
 *    setTasks(snapshot); // restore optimistic update
 *    showToast("Couldn't save task. Changes have been undone.");
 *  }
 *
 *   In your JSX:
 *  <DbErrorToast error={toastError} />
 */

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

interface ToastState {
  message: string;
  visible: boolean;
}

export function useDbErrorToast() {
  const [toastError, setToastError] = useState<ToastState>({
    message: "",
    visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    // Clear any existing timer so multiple rapid errors don't overlap
    if (timerRef.current) clearTimeout(timerRef.current);

    setToastError({ message, visible: true });

    timerRef.current = setTimeout(() => {
      setToastError((prev) => ({ ...prev, visible: false }));
    }, 6000);
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastError((prev) => ({ ...prev, visible: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toastError, showToast, dismissToast };
}

// ─── component ────────────────────────────────────────────────────────────────

interface DbErrorToastProps {
  error: ToastState;
  onDismiss?: () => void;
}

export function DbErrorToast({ error, onDismiss }: DbErrorToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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
      <View style={styles.toast}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Save failed</Text>
          <Text style={styles.message} numberOfLines={2}>
            {error.message}
          </Text>
        </View>

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