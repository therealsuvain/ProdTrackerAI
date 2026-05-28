import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";

interface TagAnalyticsModalProps {
  tagId: string;
  onClose: () => void;
  onEdit: (tagId: string) => void;
  onDelete: (tagId: string) => void;
}

export const TagAnalyticsModal = ({
  tagId,
  onClose,
  onEdit,
  onDelete,
}: TagAnalyticsModalProps) => {
  const { theme } = useContext(ThemeContext);
  const { tags, getTagUsageForAll } = useData();

  const [stats, setStats] = useState({
    tasks: 0,
    habits: 0,
    events: 0,
    logs: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const tag = tags.find((t) => t.id === tagId);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const data = await getTagUsageForAll(tagId);
      const mockData = { tasks: 8, habits: 2, events: 1, logs: 4, total: 15 };
      setStats(data);
      setIsLoading(false);
    };
    if (tagId) fetchStats();
  }, [tagId]);

  // Waffle Chart Logic (4x10 Grid) exactly as implemented for Categories
  const waffleDots = useMemo(() => {
    const DOTS = 40;
    let taskDots = 0,
      habitDots = 0,
      eventDots = 0,
      logDots = 0;

    if (stats.total > 0 && stats.total <= DOTS) {
      taskDots = stats.tasks;
      habitDots = stats.habits;
      eventDots = stats.events;
      logDots = stats.logs;
    } else if (stats.total > DOTS) {
      taskDots = Math.round((stats.tasks / stats.total) * DOTS);
      habitDots = Math.round((stats.habits / stats.total) * DOTS);
      eventDots = Math.round((stats.events / stats.total) * DOTS);
      logDots = Math.round((stats.logs / stats.total) * DOTS);
      const sum = taskDots + habitDots + eventDots + logDots;
      if (sum !== DOTS) taskDots += DOTS - sum;
    }

    const dotsArray: string[] = [];
    const pushDots = (count: number, color: string) => {
      for (let i = 0; i < count; i++) dotsArray.push(color);
    };

    pushDots(taskDots, theme.taskBase);
    pushDots(habitDots, theme.habitBase);
    pushDots(eventDots, theme.eventBase);
    pushDots(logDots, theme.timerBase);

    const remaining = DOTS - dotsArray.length;
    pushDots(remaining, theme.greyBasePrimary + "40");

    return dotsArray;
  }, [stats, theme]);

  if (!tag) return null;

  return (
    <Modal
      visible={!!tagId}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: theme.background }]}
        >
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.tagName, { color: theme.whiteBase }]}>
                # {tag.name}
              </Text>
              <View style={styles.totalBadge}>
                <Text style={[styles.totalText, { color: theme.whiteBase }]}>
                  {stats.total}
                </Text>
                <Text
                  style={[styles.totalLabel, { color: theme.greyBasePrimary }]}
                >
                  Allotted
                </Text>
              </View>
            </View>

            <Text
              style={[styles.sectionTitle, { color: theme.greyBasePrimary }]}
            >
              Usage History
            </Text>

            {isLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.whiteBase}
                style={{ marginVertical: 30 }}
              />
            ) : (
              <View style={styles.waffleContainer}>
                {waffleDots.map((dotColor, index) => (
                  <View
                    key={index}
                    style={[styles.dot, { backgroundColor: dotColor }]}
                  />
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.actionBtn,
                  { borderColor: theme.greyBasePrimary },
                ]}
                onPress={() => onEdit(tagId)}
              >
                <Ionicons name="pencil" size={18} color={theme.whiteBase} />
                <Text style={[styles.actionText, { color: theme.whiteBase }]}>
                  Edit
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  { borderColor: theme.error || "#ef4444" },
                ]}
                onPress={() => onDelete(tagId)}
              >
                <Ionicons
                  name="trash"
                  size={18}
                  color={theme.error || "#ef4444"}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.error || "#ef4444" },
                  ]}
                >
                  Delete
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.greyBasePrimary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ... Same styles as CategoryAnalyticsModal ...
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingRight: 32,
  },
  tagName: { fontSize: 24, fontWeight: "bold" },
  totalBadge: { alignItems: "flex-end" },
  totalText: { fontSize: 20, fontWeight: "bold" },
  totalLabel: { fontSize: 12, textTransform: "uppercase" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  waffleContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  dot: { width: 20, height: 20, borderRadius: 10 },
  actionRow: { flexDirection: "row", gap: 16, marginTop: "auto" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  actionText: { fontSize: 16, fontWeight: "bold" },
  closeBtn: { position: "absolute", top: -10, right: -10, padding: 8 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    margin: 20,
  },
});
