import { Modal, Pressable, Text, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { Ionicons } from "@expo/vector-icons";
import { ChartInfoDetails } from "./chart-detail-config";

// chart-info-modal.tsx — reusable across all charts, same shell pattern as TooltipShell
interface ChartInfoModalProps {
  visible: boolean;
  onClose: () => void;
  chartDetails: ChartInfoDetails;
}

export const ChartInfoModal = ({
  visible,
  onClose,
  chartDetails: { title, description, howToRead },
}: ChartInfoModalProps) => {
  const { theme } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { borderColor: "#ffffffce", backgroundColor: "#ffffff1e" },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <View style={styles.iconBadge}>
              <Ionicons
                name="information-outline"
                size={28}
                color={theme.blackBase}
              />
            </View>
          </View>

          <Text style={[styles.body, { color: theme.text }]}>
            {description}
          </Text>
          <>
            <View style={styles.divider}>
              <Text style={[{ color: "white" }]}>
                ______________________________________________________
              </Text>
            </View>
            <Text style={[styles.subheading, { color: theme.text }]}>
              How to read it
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>
              •{howToRead.xAxis}
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>
              •{howToRead.yAxis}
            </Text>
            {howToRead.extraInfo && (
              <Text style={[styles.extraInfo, { color: theme.text }]}>
                {howToRead.extraInfo}
              </Text>
            )}
          </>
          <Pressable
            onPress={onClose}
            style={[
              styles.closeButton,
              { borderColor: "#ffffffce", backgroundColor: "#ffffff1a" },
            ]}
          >
            <Text style={styles.closeButtonText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
  sheet: {
    //width: "100%",
    minWidth: "85%",
    maxWidth: "95%",
    borderRadius: 20,
    borderWidth: 0.75,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    //alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconBadgeText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  divider: {
    width: "100%",
  },
  subheading: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  closeButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.375,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  extraInfo: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: 4,
  },
});
