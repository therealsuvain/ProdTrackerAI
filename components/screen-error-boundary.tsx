/**
 * screen-error-boundary.tsx
 *
 * A contained error boundary for individual tab screens. When a screen-level
 * error is caught here it does NOT crash the whole app — the tab bar and all
 * other screens remain fully usable.
 *
 * Features
 * ────────
 *  • Accepts a `screenName` prop so the fallback copy is contextual
 *    ("Timer crashed" vs. a generic message).
 *  • "Try again" resets only that screen's boundary — zero full-app reload.
 *  • Dev panel: collapsible error message + stack trace, same visual language
 *    as RootFallbackComponent so devs get a consistent experience.
 *
 * Usage
 * ─────
 *  // In your tab _layout or directly wrapping each screen component:
 *
 *  import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
 *
 *  <ScreenErrorBoundary screenName="Timer">
 *    <TimerScreen />
 *  </ScreenErrorBoundary>
 *
 *  // Or if you want the boundary at the route level in (tabs)/_layout.tsx:
 *
 *  <Tabs.Screen
 *    name="timer-screen"
 *    // wrap the component in the layout, not here in options
 *  />
 *
 * Best placement: wrap each screen's default export directly — that way the
 * boundary survives tab navigation re-mounts without needing a key prop.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";

// ─── types ───────────────────────────────────────────────────────────────────

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  /** Human-readable screen name shown in the fallback UI, e.g. "Timer" */
  screenName?: string;
}

// ─── inner fallback (needs screenName closed over) ───────────────────────────

function makeScreenFallback(screenName: string) {
  // react-error-boundary requires the fallback to be a stable component ref,
  // so we return a named component rather than an inline arrow function.
  function ScreenFallback({ error, resetErrorBoundary }: FallbackProps) {
    const [devPanelOpen, setDevPanelOpen] = useState(true);

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error ?? "Unknown error");
    const stackTrace =
      error instanceof Error && error.stack
        ? error.stack
        : "No stack available";

    return (
      <View style={styles.root}>
        {/* ── Production layer ───────────────────────────────────────── */}
        <View style={styles.productionCard}>
          <Text style={styles.iconEmoji}>💥</Text>

          <Text style={styles.headline}>
            {screenName} ran into a problem
          </Text>
          <Text style={styles.subheadline}>
            This screen crashed but the rest of the app is fine. Your data
            hasn't been affected.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={resetErrorBoundary}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>↺  Try Again</Text>
          </TouchableOpacity>
        </View>

        {/* ── Dev panel ──────────────────────────────────────────────── */}
        {__DEV__ && (
          <View style={styles.devSection}>
            <TouchableOpacity
              style={styles.devHeaderRow}
              onPress={() => setDevPanelOpen((o) => !o)}
              activeOpacity={0.7}
            >
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>DEV</Text>
              </View>
              <Text style={styles.devHeaderTitle}>
                {screenName} Error Details
              </Text>
              <Text style={styles.devChevron}>
                {devPanelOpen ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>

            {devPanelOpen && (
              <ScrollView
                style={styles.devScrollView}
                contentContainerStyle={styles.devScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                <Text style={styles.devSectionLabel}>ERROR</Text>
                <View style={styles.devCodeBlock}>
                  <Text style={styles.devErrorMessage} selectable>
                    {errorMessage}
                  </Text>
                </View>

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

  // Give it a display name for React DevTools
  ScreenFallback.displayName = `${screenName}ScreenFallback`;
  return ScreenFallback;
}

// ─── public component ────────────────────────────────────────────────────────

export function ScreenErrorBoundary({
  children,
  screenName = "This screen",
}: ScreenErrorBoundaryProps) {
  // Stable reference: only recreate the fallback if screenName changes
  // (which in practice never happens — each boundary has a fixed name)
  const FallbackComponent = React.useMemo(
    () => makeScreenFallback(screenName),
    [screenName],
  );

  return (
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      {children}
    </ErrorBoundary>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const DARK_BG = "#0F0F0F";
const CARD_BG = "#1A1A1A";
const BORDER = "#2A2A2A";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#E05252";
const DEV_BG = "#0D1117";
const DEV_BORDER = "#30363D";
const DEV_TEXT = "#E6EDF3";
const DEV_LABEL = "#7D8590";
const DEV_BADGE_BG = "#DA3633";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
    padding: 20,
  },

  // ── Production card ───────────────────────────────────────────────────────
  productionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 36,
    marginBottom: 16,
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subheadline: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
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
    color: "#FF7B72",
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