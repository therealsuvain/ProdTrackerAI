import { View, Text, ScrollView, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  measure,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

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
import { useCallback, useRef } from "react";

export default function AnalyticsScreen() {
  const { activeWidgets, toggleWidget, reorderWidgets } = useDashboardLayout();
  const { tasks } = useTasks();
  const { timerLogs } = useLogs();
  const { events } = useEvents();
  const { habits } = useHabits();
  const { tags, categories, appMetrics } = useData();
  const { theme } = useTheme();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewportRef = useRef({ pageY: 0, height: 0 });
  const viewportWrapperRef = useRef<View>(null);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const measureViewport = useCallback(() => {
    viewportWrapperRef.current?.measureInWindow((_x, y, _w, height) => {
      viewportRef.current = { pageY: y, height };
    });
  }, []);
  /*  const measureViewport = useCallback(() => {
    scheduleOnUI(() => {
      "worklet";
      const dimensions = measure(scrollRef);
      if (dimensions === null) return;
      const { pageY, height } = dimensions;
      scheduleOnRN(() => {
        viewportRef.current = { pageY, height };
      });
    });
  }, [scrollRef]); */
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
          <AnalyticsHeatmap metrics={DummyMetrics} />

          {/*  {activeWidgets.map((widgetId) => {
          const ChartComponent = CHART_REGISTRY[widgetId];

          if (!ChartComponent) return null; // Failsafe for deprecated widgets

          return (
            <View key={widgetId} style={styles.widgetContainer}>
              <ChartComponent
                metrics={DummyMetrics}
                tasks={DummyTasks}
                habits={DummyHabits}
                logs={DummyTimerLogs}
                events={DummyEvents}
                tags={DummyTags}
                categories={DummyCategories}
              />
            </View>
          );
        })} */}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  widgetContainer: {
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
