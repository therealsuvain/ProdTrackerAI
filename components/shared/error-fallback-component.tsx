/**
 * error-fallback-component.tsx
 *
 * The full-screen fallback rendered by the ROOT ErrorBoundary when a
 * catastrophic error bubbles past every screen-level boundary (e.g. a crash
 * inside a Provider, the navigation tree, etc.).
 *
 * Layout
 * ──────
 *  • Production layer  — always visible. User-friendly copy, restart action.
 *  • Dev-only panel    — visible only when __DEV__ is true. Shows error
 *                        message + full stack trace in a scrollable code block.
 *
 * Usage (in _layout.tsx)
 * ──────────────────────
 *  import { ErrorBoundary } from "react-error-boundary";
 *  import { RootFallbackComponent } from "@/components/error-fallback-component";
 *
 *  <ErrorBoundary FallbackComponent={RootFallbackComponent}>
 *    {children}
 *  </ErrorBoundary>
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { FallbackProps } from "react-error-boundary";
import * as Updates from "expo-updates";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Attempt a full OTA reload; fall back to just calling resetErrorBoundary. */
function useRestartApp(resetErrorBoundary: () => void) {
  return async () => {
    try {
      // expo-updates is present in managed/bare workflows.
      // In dev the reload is instant; in prod it re-fetches the JS bundle.
      await Updates.reloadAsync();
    } catch {
      // In bare workflow without expo-updates configured, or in Jest/Storybook,
      // reloadAsync throws — fall back to resetting the boundary instead.
      resetErrorBoundary();
    }
  };
}

// ─── component ───────────────────────────────────────────────────────────────

export function RootFallbackComponent({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  const restartApp = useRestartApp(resetErrorBoundary);
  const [devPanelOpen, setDevPanelOpen] = useState(true);

  // Normalise — error could theoretically be a non-Error throw
  const errorMessage =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const stackTrace =
    error instanceof Error && error.stack ? error.stack : "No stack available";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Production layer ─────────────────────────────────────────── */}
      <View style={styles.productionSection}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconEmoji}>⚠️</Text>
        </View>

        {/* Copy */}
        <Text style={styles.headline}>Something went wrong</Text>
        <Text style={styles.subheadline}>
          The app ran into an unexpected problem. Your data is safe — this
          didn't affect anything you've saved.
        </Text>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.restartButton}
          onPress={restartApp}
          activeOpacity={0.85}
        >
          <Text style={styles.restartButtonText}>Restart App</Text>
        </TouchableOpacity>

        {/* Secondary CTA — resets boundary without full reload, useful if the
            crash was transient (e.g. a one-off bad render) */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={resetErrorBoundary}
          activeOpacity={0.75}
        >
          <Text style={styles.retryButtonText}>Try again without restarting</Text>
        </TouchableOpacity>
      </View>

      {/* ── Dev-only panel ───────────────────────────────────────────── */}
      {__DEV__ && (
        <View style={styles.devSection}>
          {/* Collapsible header */}
          <TouchableOpacity
            style={styles.devHeaderRow}
            onPress={() => setDevPanelOpen((o) => !o)}
            activeOpacity={0.7}
          >
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV</Text>
            </View>
            <Text style={styles.devHeaderTitle}>Error Details</Text>
            <Text style={styles.devChevron}>{devPanelOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {devPanelOpen && (
            <ScrollView
              style={styles.devScrollView}
              contentContainerStyle={styles.devScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Error message */}
              <Text style={styles.devSectionLabel}>ERROR</Text>
              <View style={styles.devCodeBlock}>
                <Text style={styles.devErrorMessage} selectable>
                  {errorMessage}
                </Text>
              </View>

              {/* Stack trace */}
              <Text style={[styles.devSectionLabel, { marginTop: 12 }]}>
                STACK TRACE
              </Text>
              <View style={styles.devCodeBlock}>
                <Text style={styles.devStackTrace} selectable>
                  {stackTrace}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const DARK_BG = "#0F0F0F";
const CARD_BG = "#1A1A1A";
const BORDER = "#2A2A2A";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#E05252"; // red — communicates "error" without being garish
const DEV_BG = "#0D1117"; // GitHub dark — familiar to devs
const DEV_BORDER = "#30363D";
const DEV_TEXT = "#E6EDF3";
const DEV_LABEL = "#7D8590";
const DEV_BADGE_BG = "#DA3633";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  // ── Production section ────────────────────────────────────────────────────
  productionSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 32,
  },
  headline: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 36,
  },
  restartButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  restartButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  retryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  retryButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "500",
  },

  // ── Dev section ───────────────────────────────────────────────────────────
  devSection: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DEV_BORDER,
    backgroundColor: DEV_BG,
    overflow: "hidden",
  },
  devHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DEV_BORDER,
    gap: 8,
  },
  devBadge: {
    backgroundColor: DEV_BADGE_BG,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  devBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  devHeaderTitle: {
    flex: 1,
    color: DEV_TEXT,
    fontSize: 13,
    fontWeight: "600",
  },
  devChevron: {
    color: DEV_LABEL,
    fontSize: 11,
  },
  devScrollView: {
    flex: 1,
  },
  devScrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  devSectionLabel: {
    color: DEV_LABEL,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  devCodeBlock: {
    backgroundColor: "#010409",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: DEV_BORDER,
  },
  devErrorMessage: {
    color: "#FF7B72", // GitHub's red for errors — readable, not alarming
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  devStackTrace: {
    color: DEV_TEXT,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 17,
    opacity: 0.8,
  },
});
// import React, { ErrorInfo, ReactNode } from 'react';
// import { ErrorBoundary as ReactErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
// import { View, Text, Button } from 'react-native';
// import { useData } from '@/hooks/use-data';

//  export const FallbackComponent = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
//   const { clearError } = useData(); // Global clear

//   return (
//     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
//       <Text style={{ fontSize: 18, marginBottom: 10 }}>Something went wrong!</Text>
//       <Text style={{ fontSize: 14, color: 'gray', marginBottom: 20 }}>{error.message}</Text>
//       <Button title="Retry" onPress={() => { resetErrorBoundary(); clearError(); }} />
//     </View>
//   );
// };

