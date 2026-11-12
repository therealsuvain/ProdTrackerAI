import React, { useState } from "react";
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Text,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
  MODAL_BASE_WIDTH,
  CHART_INFO_DETAILS,
} from "./chart-detail-config";
import { Ionicons } from "@expo/vector-icons";
import {
  setTranslate,
  setScale,
  useChartTransformState,
  getTransformComponents,
} from "victory-native";
import { ChartProps } from "../charts-registry";
import { ChartInfoModal } from "./charts-explanation-modal";
import { ChartFilterModal } from "./chart-detail-filter-modal";
import {
  useFiltersStore,
  useResolvedChartFilters,
} from "@/hooks/use-filters-store";
import { Category } from "@/types/category";
import { Tag } from "@/types/tag";

interface Props {
  visible: boolean;
  onClose: () => void;
  chartId: string | null;
  children: React.ReactElement<ChartProps> | null;
  tags?: Tag[];
  categories?: Category[];
}

/**
 * 
 * export const BASE_CHART_HEIGHT = 400;
export const MODAL_BASE_WIDTH = 640;


 * export const CHART_DETAIL_SCALE: Record<string, DetailScale> = {
  execution_funnel: { heightScale: 2, widthScale: 1 },
  momentum_delta: { heightScale: 2, widthScale: 1 },
  time_durations: { heightScale: 2, widthScale: 1 },
  task_velocity: { heightScale: 2, widthScale: 1 },
  habit_consistency: { heightScale: 2, widthScale: 1 },
  task_throughput: { heightScale: 2, widthScale: 1 },
  ai_leverage: { heightScale: 2, widthScale: 1 },
  circadian_friction: { heightScale: 1.8, widthScale: 1.3 },
  deep_work: { heightScale: 1.6, widthScale: 1.6 },
  task_procrastination: { heightScale: 2, widthScale: 1 },
  priority_completion : { heightScale: 2, widthScale: 1 },
  freeze_reliance : { heightScale: 2, widthScale: 1 },
  chat_follow_through: { heightScale: 2, widthScale: 1 },
  session_distribution: { heightScale: 2, widthScale: 1 },
};

export function getDetailScale(id: string): DetailScale {
  return CHART_DETAIL_SCALE[id] ?? DEFAULT_DETAIL_SCALE;
}
 */
const MAX_WRAPPER_WIDTH = Dimensions.get("window").width - 48;
const MAX_WRAPPER_HEIGHT = Dimensions.get("window").height - 120;

export const ChartDetailModal = ({
  visible,
  onClose,
  chartId,
  children,
  tags = [],
  categories = [],
}: Props) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { heightScale, widthScale } = getDetailScale(chartId ?? "");
  const [chartInfoModal, setChartInfoModal] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const setChartDateRangeOverride = useFiltersStore(
    (s) => s.setChartDateRangeOverride,
  );
  const setChartAdvancedFilter = useFiltersStore(
    (s) => s.setChartAdvancedFilter,
  );
  const { dateRange, advanced } = useResolvedChartFilters(chartId ?? "");
  // 1. Calculate safe available screen bounds dynamically
  const maxCardWidth = windowWidth - 24; // 12px margin on each side
  const maxCardHeight = windowHeight - insets.top - insets.bottom - 32;

  // 2. Reserve ~116px for the Header row (40px) + Bottom Button row (56px) + paddings (20px)
  const CHROME_HEIGHT = 116;
  const desiredChartHeight = BASE_CHART_HEIGHT * heightScale;
  const chartHeight = Math.min(
    desiredChartHeight,
    maxCardHeight - CHROME_HEIGHT,
  );
  const cardWidth = Math.min(MODAL_BASE_WIDTH * widthScale, maxCardWidth);
  const chartWidth = cardWidth - 16; // 12px padding on each side

  // 3. Dynamically size buttons so 7 buttons + 6 gaps ALWAYS fit inside cardWidth
  const horizontalPadding = 24; // 12px left + 12px right
  const buttonGap = 8;
  const maxButtonSize = Math.floor(
    (cardWidth - horizontalPadding - buttonGap * 6) / 7,
  );
  const buttonSize = Math.min(44, maxButtonSize); // Caps at 44px on big phones, shrinks to ~38px on small phones
  const iconSize = Math.round(buttonSize * 0.65);

  const wrapperWidth = Math.min(
    MODAL_BASE_WIDTH * widthScale,
    MAX_WRAPPER_WIDTH,
  );
  const wrapperHeight = Math.min(
    BASE_CHART_HEIGHT * heightScale,
    MAX_WRAPPER_HEIGHT,
  );
  /*   console.log(
    "wrapperWidth",
    wrapperWidth,
    "wrapperHeight",
    MAX_WRAPPER_HEIGHT,
  ); */
  const detailsChartButtonSize = 32;
  const { state: transformState } = useChartTransformState({
    scaleX: 1.0,
    scaleY: 1.0,
  });
  const panLeft = () => {
    const { translateX, translateY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setTranslate(
      transformState.matrix.value,
      translateX + 50,
      translateY,
    );
  };

  const resetView = () => {
    const resetValue = setScale(transformState.matrix.value, 1, 1);
    transformState.matrix.value = setTranslate(resetValue, 0, 0);
  };

  const panRight = () => {
    const { translateX, translateY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setTranslate(
      transformState.matrix.value,
      translateX - 50,
      translateY,
    );
  };

  const panUp = () => {
    const { translateX, translateY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setTranslate(
      transformState.matrix.value,
      translateX,
      translateY + 50,
    );
  };

  const panDown = () => {
    const { translateX, translateY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setTranslate(
      transformState.matrix.value,
      translateX,
      translateY - 50,
    );
  };

  const scaleUp = () => {
    const { scaleX, scaleY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setScale(
      transformState.matrix.value,
      scaleX + 0.1,
      scaleY + 0.1,
    );
  };

  const scaleDown = () => {
    const { scaleX, scaleY } = getTransformComponents(
      transformState.matrix.value,
    );
    transformState.matrix.value = setScale(
      transformState.matrix.value,
      scaleX - 0.1,
      scaleY - 0.1,
    );
  };

  const onCloseChartInfo = () => {
    setChartInfoModal(false);
  };

  const onChartClose = () => {
    onClose();
    resetView();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onChartClose}
    >
      <GestureHandlerRootView>
        <Pressable style={styles.backdrop} onPress={onChartClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.card,
              {
                width: cardWidth,
                maxHeight: maxCardHeight,
                backgroundColor: isDarkMode
                  ? theme.taskDarkPrimary
                  : theme.greyTimeline,
                borderColor:
                  theme.taskDarkSecondary ?? "rgba(255,255,255,0.08)",
              },
            ]}
            /* onPress={() => {}} */
          >
            <View style={styles.headerBar}>
              <Pressable
                onPress={() => setFilterModalVisible(true)}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name="filter-outline"
                  size={24}
                  color={theme.whiteBase}
                />
              </Pressable>
              <Pressable
                onPress={() => setChartInfoModal(true)}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name="help-outline"
                  size={24}
                  color={theme.whiteBase}
                />
              </Pressable>
              <Pressable onPress={onChartClose} style={styles.headerIconButton}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            {/*  <View
              style={{
                width: wrapperWidth,
                height: wrapperHeight,
                alignItems: "center",
                justifyContent: "center",
              }}
            > */}
            <View
              style={{
                width: chartWidth,
                height: chartHeight,
                overflow: "hidden",
                alignItems: "center",
              }}
            >
              {React.isValidElement(children)
                ? React.cloneElement(children, { transformState })
                : children}
            </View>
            {/*  </View> */}

            {/* <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}> */}
            <View style={[styles.controlsRow, { gap: buttonGap }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  {
                    backgroundColor: theme.error,
                    borderBottomColor: "rgb(172, 0, 0)",
                    borderRightColor: "rgb(172, 0, 0)",
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={resetView}
              >
                <Ionicons
                  name="refresh-outline"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={panLeft}
              >
                <Ionicons
                  name="chevron-back"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={panUp}
              >
                <Ionicons
                  name="chevron-up"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={panDown}
              >
                <Ionicons
                  name="chevron-down"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={panRight}
              >
                <Ionicons
                  name="chevron-forward"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={scaleUp}
              >
                <Ionicons
                  name="chevron-expand"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                  pressed && {
                    borderBottomWidth: 0,
                    borderRightWidth: 0,
                  },
                ]}
                onPress={scaleDown}
              >
                <Ionicons
                  name="chevron-collapse"
                  size={detailsChartButtonSize}
                  color={theme.text}
                />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
      {chartInfoModal && (
        <ChartInfoModal
          visible={chartInfoModal}
          onClose={onCloseChartInfo}
          chartDetails={CHART_INFO_DETAILS[chartId ?? ""]}
        />
      )}
      {chartId && dateRange && (
        <ChartFilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          chartId={chartId}
          currentDateRange={dateRange}
          currentAdvanced={advanced}
          availableTags={tags.map((t) => ({ id: t.id, name: t.name }))}
          availableCategories={categories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          onApplyDateRange={(range) =>
            setChartDateRangeOverride(chartId, range)
          }
          onApplyAdvanced={(adv) => setChartAdvancedFilter(chartId, adv)}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    /* paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 12, */
    /* marginVertical: 24,
    marginHorizontal: 120, */
    //alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 2,
    flexDirection: "column",
  },
  headerBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff1a",
    alignItems: "center",
    justifyContent: "center",
  },

  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },

  closeButtonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  detailsChartButtons: {
    /* height: 44,
    width: 44, */
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#7c7a7a",
    borderBottomColor: "#4d4d4d",
    borderRightColor: "#4d4d4d",
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 22,
    /* borderRadius: 22, */
  },
});
