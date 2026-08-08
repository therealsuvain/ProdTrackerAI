import { View, Text, ScrollView, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  measure,
} from "react-native-reanimated";

import {
  DummyMetrics,
  DummyTasks,
  DummyTimerLogs,
  DummyEvents,
  DummyHabits,
  DummyTags,
  DummyCategories,
} from "@/constants/dummy-metrics";

import { AnalyticsHeatmap } from "@/components/ui/analytics/charts/chart-unified-heatmap";
import { useDashboardLayout } from "@/components/ui/analytics/charts-prefs";
import { LayoutManagerFAB } from "@/components/ui/analytics/charts-FAB";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { useData } from "@/hooks/context-hooks/use-data";
import { AnalyticsBentoGrid } from "@/components/ui/analytics/charts-layout/bento-grid";
import { useCallback, useRef, useState } from "react";
import { useChat } from "@/hooks/context-hooks/use-chat";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { AnalyticsSkeleton } from "@/components/shared/loading-indicators/screen-loaders/analytics-skeleton";
import { GlobalDateRangePicker } from "@/components/ui/analytics/charts-layout/global-range-date-picker";
import { GlobalFilterModal } from "@/components/ui/analytics/charts-layout/global-filter-modal";
import { AnalyticsFilterBar } from "@/components/ui/analytics/charts-layout/analytics-filter-bar";
import { useFiltersStore } from "@/hooks/use-filters-store";

//TODO certain charts when rendered in chart-details-modal, need some barWidth, fontSzie, viewPort, domainPadding etc. changes
function AnalyticsScreenInner() {
  const { activeWidgets, toggleWidget, reorderWidgets, resetLayout } =
    useDashboardLayout();
  const { tasks } = useTasks();
  const { timerLogs } = useLogs();
  const { events } = useEvents();
  const { habits } = useHabits();
  const { tags, categories, appMetrics } = useData();
  const { messages } = useChat();
  const { theme } = useTheme();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewportRef = useRef({ pageY: 0, height: 0 });
  const viewportWrapperRef = useRef<View>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const globalDateRange = useFiltersStore((s) => s.global.dateRange);
  const setGlobalDateRange = useFiltersStore((s) => s.setGlobalDateRange);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const measureViewport = useCallback(() => {
    viewportWrapperRef.current?.measureInWindow((_x, y, _w, height) => {
      viewportRef.current = { pageY: y, height };
    });
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        ref={viewportWrapperRef}
        style={{ flex: 1 }}
        onLayout={measureViewport}
      >
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onLayout={measureViewport}
          contentContainerStyle={{
            backgroundColor: theme.background,
            paddingHorizontal: 16,
            paddingBottom: 32,
          }}
        >
          <AnalyticsFilterBar
            onOpenDatePicker={() => setDatePickerVisible(true)}
            onOpenFilterModal={() => setFilterModalVisible(true)}
          />

          <GlobalDateRangePicker
            visible={datePickerVisible}
            onClose={() => setDatePickerVisible(false)}
            currentRange={globalDateRange}
            onApply={(range) => {
              setGlobalDateRange(range);
              setDatePickerVisible(false);
            }}
          />

          <GlobalFilterModal
            visible={filterModalVisible}
            onClose={() => setFilterModalVisible(false)}
          />
          <AnalyticsHeatmap metrics={DummyMetrics} />
          <AnalyticsBentoGrid
            order={activeWidgets}
            onReorder={reorderWidgets}
            onRemove={toggleWidget}
            scrollY={scrollY}
            scrollRef={scrollRef}
            viewportRef={viewportRef}
            chartProps={{
              metrics: DummyMetrics,
              tasks: DummyTasks,
              habits: DummyHabits,
              logs: DummyTimerLogs,
              events: DummyEvents,
              tags: DummyTags,
              categories: DummyCategories,
            }}
          />
        </Animated.ScrollView>
      </View>
      <LayoutManagerFAB
        activeWidgets={activeWidgets}
        toggleWidget={toggleWidget}
        resetLayout={resetLayout}
      />
    </View>
  );
}

export default function AnalyticsScreen() {
  const { isDarkMode } = useTheme();
  const isReady = useScreenReady();
  if (!isReady) return <AnalyticsSkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Analytics">
      <AnalyticsScreenInner />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  widgetContainer: {
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
