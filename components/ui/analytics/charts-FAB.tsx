import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CHART_REGISTRY } from "./charts-registry";
import { useDashboardLayout } from "./charts-prefs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  activeWidgets: string[];
  toggleWidget: (widgetId: string) => void;
  resetLayout: () => void;
}
export const LayoutManagerFAB = ({
  activeWidgets,
  toggleWidget,
  resetLayout,
}: Props) => {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Extract all available chart IDs from the registry
  const availableCharts = Object.keys(CHART_REGISTRY);

  const renderChartOption = ({ item: widgetId }: { item: string }) => {
    const isActive = activeWidgets.includes(widgetId);
    // Format ID for UI (e.g., 'execution_funnel' -> 'Execution Funnel')
    const displayName = widgetId
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return (
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => toggleWidget(widgetId)}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionText, isActive && styles.activeText]}>
          {displayName}
        </Text>
        {isActive && <Ionicons name="checkmark" size={24} color="#212121" />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="options-outline" size={24} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize Dashboard</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableCharts}
              keyExtractor={(item) => item}
              renderItem={renderChartOption}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 48,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#212121", // Strict monochrome foreground
    borderWidth: 0.5,
    borderColor: "#474747",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#ffffff",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#212121",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  optionText: {
    fontSize: 16,
    color: "#757575",
  },
  activeText: {
    color: "#212121",
    fontWeight: "600",
  },
  chartContainer: {
    height: 250,
    width: "100%",
    padding: 16,
  },
});
