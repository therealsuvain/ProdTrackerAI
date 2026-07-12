import React from "react";
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
} from "./chart-detail-config";
import { Ionicons } from "@expo/vector-icons";
import {
  setTranslate,
  setScale,
  useChartTransformState,
  getTransformComponents,
} from "victory-native";
import { ChartProps } from "../charts-registry";

interface Props {
  visible: boolean;
  onClose: () => void;
  chartId: string | null;
  children: React.ReactElement<ChartProps> | null;
}

const MAX_WRAPPER_WIDTH = Dimensions.get("window").width - 48;

export const ChartDetailModal = ({
  visible,
  onClose,
  chartId,
  children,
}: Props) => {
  const { theme } = useTheme();
  const { heightScale, widthScale } = getDetailScale(chartId ?? "");

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: theme.taskDarkPrimary ?? "#1C1C1E",
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
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>x</Text>
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
    backgroundColor: "rgba(255,255,255,0.1)",
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
