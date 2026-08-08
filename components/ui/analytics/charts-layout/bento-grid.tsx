import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  Pressable,
  Text,
  Dimensions,
} from "react-native";
import { CHART_REGISTRY, ChartProps } from "../charts-registry";
import { computeGridLayout } from "./chart-tile-config";
import { ChartTile } from "./chart-tile";
import { ChartDetailModal } from "./chart-detail-modal";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { Portal } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { SharedValue } from "react-native-reanimated";
import { FilteredChart } from "./filtered-chart-component-wrapper";

interface Props {
  order: string[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (id: string) => void;
  chartProps: ChartProps;
  scrollY: SharedValue<number>;
  scrollRef: React.RefObject<any>;
  viewportRef: React.MutableRefObject<{ pageY: number; height: number }>;
}

const INITIAL_WIDTH_GUESS = Dimensions.get("window").width - 32;
// How far "into" a neighbor's rect (as a fraction of its own width/height)
// the dragged tile's center has to travel before it counts as a real
// crossing, rather than a shallow graze right at the shared edge.
const HOT_ZONE_INSET_RATIO = 0.22;

// Distance (px) the dragged tile's center must travel away from wherever
// the last reorder fired before a new one is allowed to trigger. This is
// what stops a trembling finger sitting near a swap boundary from firing
// the reorder dozens of times a second (the neighbor "ping-ponging" back
// and forth) — every reorder resets this checkpoint, and nothing else can
// fire until the finger has genuinely moved on.
const MIN_MOVE_TO_RETRIGGER = 28;
const AUTO_SCROLL_EDGE = 70; // px from the viewport edge that triggers scrolling
const AUTO_SCROLL_SPEED = 12; // px per tick

export const AnalyticsBentoGrid = ({
  order,
  onReorder,
  onRemove,
  chartProps,
  scrollY,
  scrollRef,
  viewportRef,
}: Props) => {
  const { theme } = useTheme();
  const [containerWidth, setContainerWidth] = useState(INITIAL_WIDTH_GUESS);
  const [editMode, setEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lastAbsoluteYRef = useRef<number | null>(null);

  // Gesture callbacks fire on every animation frame, so we keep the current
  // order in a ref to avoid stale closures without re-subscribing gestures.
  const orderRef = useRef(order);
  orderRef.current = order;

  const lastSwapPointRef = useRef<{ x: number; y: number } | null>(null);

  const { rects, totalHeight } = useMemo(
    () => computeGridLayout(order, containerWidth),
    [order, containerWidth],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const handleLongPressStart = useCallback((id: string) => {
    setEditMode(true);
    setDraggedId(id);
  }, []);

  // Point-in-rect hit testing against the *last computed* layout to decide
  // whether the dragged tile has been carried far enough to swap places with
  // a neighbor. Cheap, and only runs while a drag is in progress.
  const handleDragMove = useCallback(
    (id: string, centerX: number, centerY: number, absoluteY: number) => {
      lastAbsoluteYRef.current = absoluteY;
      if (lastSwapPointRef.current) {
        const dx = centerX - lastSwapPointRef.current.x;
        const dy = centerY - lastSwapPointRef.current.y;
        if (Math.hypot(dx, dy) < MIN_MOVE_TO_RETRIGGER) return;
      }

      const currentOrder = orderRef.current;
      let targetId: string | null = null;

      for (const otherId of currentOrder) {
        if (otherId === id) continue;
        const r = rects[otherId];
        if (!r) continue;

        const insetX = r.width * HOT_ZONE_INSET_RATIO;
        const insetY = r.height * HOT_ZONE_INSET_RATIO;

        if (
          centerX >= r.x + insetX &&
          centerX <= r.x + r.width - insetX &&
          centerY >= r.y + insetY &&
          centerY <= r.y + r.height - insetY
        ) {
          targetId = otherId;
          break;
        }
      }

      if (!targetId) return;

      const fromIndex = currentOrder.indexOf(id);
      const toIndex = currentOrder.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      const next = [...currentOrder];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, id);

      lastSwapPointRef.current = { x: centerX, y: centerY };
      onReorder(next);
    },
    [rects, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    lastSwapPointRef.current = null;
    lastAbsoluteYRef.current = null;
  }, []);

  /*   const handleDragMove = useCallback(
    (id: string, centerX: number, centerY: number) => {
      const currentOrder = orderRef.current;
      let targetId: string | null = null;
      for (const otherId of currentOrder) {
        if (otherId === id) continue;
        const r = rects[otherId];
        if (!r) continue;
        if (
          centerX >= r.x &&
          centerX <= r.x + r.width &&
          centerY >= r.y &&
          centerY <= r.y + r.height
        ) {
          targetId = otherId;
          break;
        }
      }
      if (!targetId) return;

      const fromIndex = currentOrder.indexOf(id);
      const toIndex = currentOrder.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      const next = [...currentOrder];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, id);
      onReorder(next);
    },
    [rects, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []); */

  // While a tile is being dragged, keep nudging the scroll position if the
  // finger is sitting near the top/bottom edge of the visible area. Driven
  // by a plain interval rather than gesture frames so it keeps scrolling
  // even when the finger is held still at the edge, not just while moving.
  useEffect(() => {
    if (!draggedId) return;

    const interval = setInterval(() => {
      const absoluteY = lastAbsoluteYRef.current;
      const { pageY, height } = viewportRef.current;
      if (absoluteY == null || height === 0) return;

      let delta = 0;
      if (absoluteY < pageY + AUTO_SCROLL_EDGE) {
        delta = -AUTO_SCROLL_SPEED;
      } else if (absoluteY > pageY + height - AUTO_SCROLL_EDGE) {
        delta = AUTO_SCROLL_SPEED;
      }
      if (delta === 0) return;

      const nextY = Math.max(0, scrollY.value + delta);
      scrollRef.current?.scrollTo?.({ y: nextY, animated: false });
    }, 16);

    return () => clearInterval(interval);
  }, [draggedId, scrollRef, scrollY, viewportRef]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setDraggedId(null);
  }, []);
  return (
    <View>
      {editMode && (
        <Portal>
          <SafeAreaView style={styles.editBar}>
            <Pressable onPress={exitEditMode} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done Editing</Text>
            </Pressable>
          </SafeAreaView>
        </Portal>
      )}
      <View
        style={[styles.gridContainer, { height: totalHeight }]}
        onLayout={handleLayout}
      >
        {order.map((id) => {
          const ChartComponent = CHART_REGISTRY[id];

          const rect = rects[id];
          if (!ChartComponent || !rect) return null;
          return (
            <ChartTile
              key={id}
              id={id}
              rect={rect}
              editMode={editMode}
              isDragged={draggedId === id}
              scrollY={scrollY}
              onLongPressStart={handleLongPressStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onPress={setExpandedId}
              onRemove={onRemove}
            >
              <FilteredChart
                chartId={id}
                chartProps={chartProps}
                variant="grid"
              />
            </ChartTile>
          );
        })}
      </View>
      {expandedId && (
        <ChartDetailModal
          visible={!!expandedId}
          onClose={() => setExpandedId(null)}
          chartId={expandedId}
          tags={chartProps.tags}
          categories={chartProps.categories}
        >
          {/* {expandedId && CHART_REGISTRY[expandedId]
            ? React.createElement(CHART_REGISTRY[expandedId], {
                ...chartDetailProps,
                variant: "detail",
              })
            : null} */}
          <FilteredChart
            chartId={expandedId}
            chartProps={chartProps}
            variant="detail"
          />
        </ChartDetailModal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    width: "100%",
    position: "relative",
  },
  editBar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
    top: 75,
    left: -8,
  },
  editBarText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  doneButton: {
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  doneButtonText: {
    color: "white",
    fontWeight: "700",
  },
});
