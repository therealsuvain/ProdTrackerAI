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

const MAX_WRAPPER_WIDTH = Dimensions.get("window").width - 48;

export const ChartDetailModal = ({
  visible,
  onClose,
  chartId,
  children,
  tags = [],
  categories = [],
}: Props) => {
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
  const wrapperWidth = Math.min(
    MODAL_BASE_WIDTH * widthScale,
    MAX_WRAPPER_WIDTH,
  );
  const wrapperHeight = BASE_CHART_HEIGHT * heightScale;

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
            style={[
              styles.card,
              {
                backgroundColor: isDarkMode
                  ? theme.taskDarkPrimary
                  : theme.greyTimeline,
                borderColor:
                  theme.taskDarkSecondary ?? "rgba(255,255,255,0.08)",
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={{
                width: wrapperWidth,
                height: wrapperHeight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {React.isValidElement(children)
                ? React.cloneElement(children, { transformState })
                : children}
            </View>
            {/*  </View> */}
            <Pressable
              onPress={() => setFilterModalVisible(true)}
              style={[styles.closeButton, { right: 78 }]}
            >
              <Ionicons
                name="filter-outline"
                size={24}
                color={theme.whiteBase}
              />
            </Pressable>
            <Pressable
              onPress={() => setChartInfoModal(true)}
              style={styles.helpButton}
            >
              <Ionicons name="help-outline" size={24} color={theme.whiteBase} />
            </Pressable>
            <Pressable onPress={onChartClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsChartButtons,
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
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 2,
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff1a",
    alignItems: "center",
    justifyContent: "center",
  },
  helpButton: {
    position: "absolute",
    top: 8,
    right: 44,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff1a",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  detailsChartButtons: {
    height: 44,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#7c7a7a",
    borderBottomColor: "#4d4d4d",
    borderRightColor: "#4d4d4d",
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 22,
    borderRadius: 22,
  },
});
