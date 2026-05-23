import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";
// import { getCategoryUsageStats } from '@/db/repositories/category-repository';

interface CategoryAnalyticsModalProps {
  categoryId: string;
  onClose: () => void;
  onEdit: (categoryId: string) => void;
  onDelete: (categoryId: string) => void;
}

export const  CategoryEditModal = ({
  categoryId,
  onClose,
  onEdit,
  onDelete,
}: CategoryAnalyticsModalProps) => {
  const { theme } = useContext(ThemeContext);
  const { categories, getCategoryUsageForAll } = useData();

  const [stats, setStats] = useState({
    tasks: 0,
    habits: 0,
    events: 0,
    logs: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const category = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      // Replace with your actual DAO call:
      const data = await getCategoryUsageForAll(categoryId);

      // MOCK DATA FOR TESTING:
      /* const mockData = { tasks: 20, habits: 10, events: 8, logs: 8, total: 50 };
      setStats(mockData); */
      setStats(data);
      setIsLoading(false);
    };
    if (categoryId) fetchStats();
  }, [categoryId]);

  // --- Waffle Chart Logic (4x10 Grid) ---
  const waffleDots = useMemo(() => {
    const DOTS = 40;
    let taskDots = 0,
      habitDots = 0,
      eventDots = 0,
      logDots = 0;

    if (stats.total === 0) {
      // Do nothing, all 40 will be empty
    } else if (stats.total <= DOTS) {
      // 1-to-1 Mapping
      taskDots = stats.tasks;
      habitDots = stats.habits;
      eventDots = stats.events;
      logDots = stats.logs;
    } else {
      // Proportional Mapping (2.5% per dot)
      taskDots = Math.round((stats.tasks / stats.total) * DOTS);
      habitDots = Math.round((stats.habits / stats.total) * DOTS);
      eventDots = Math.round((stats.events / stats.total) * DOTS);
      logDots = Math.round((stats.logs / stats.total) * DOTS);

      // Correction for rounding errors to ensure exactly 40 dots
      const sum = taskDots + habitDots + eventDots + logDots;
      if (sum !== DOTS) {
        // Add/subtract the difference to the largest category to absorb the error smoothly
        taskDots += DOTS - sum;
      }
    }

    // Generate the array of color strings
    const dotsArray: string[] = [];
    const pushDots = (count: number, color: string) => {
      for (let i = 0; i < count; i++) dotsArray.push(color);
    };

    // Assuming your ThemeContext has these specific base colors defined:
    pushDots(taskDots, theme.taskBase);
    pushDots(habitDots, theme.habitBase);
    pushDots(eventDots, theme.eventBase);
    pushDots(logDots, theme.timerBase);

    // Fill the remainder with empty dots
    const remaining = DOTS - dotsArray.length;
    pushDots(remaining, theme.greyBasePrimary + "40"); // 40 represents alpha transparency

    return dotsArray;
  }, [stats, theme]);

  if (!category) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={[styles.categoryName, { color: theme.whiteBase }]}>
          {category.name}
        </Text>

        {/* Modular Line representing total times */}
        <View style={styles.totalBadge}>
          <Text style={[styles.totalText, { color: theme.whiteBase }]}>
            {stats.total}
          </Text>
          <Text style={[styles.totalLabel, { color: theme.greyBasePrimary }]}>
            Allotted
          </Text>
        </View>
      </View>

      {/* Usage History Section */}
      <Text style={[styles.sectionTitle, { color: theme.greyBasePrimary }]}>
        Usage History
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={category.color}
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
          style={[styles.actionBtn, { borderColor: theme.greyBasePrimary }]}
          onPress={() => onEdit(category.id)}
        >
          <Ionicons name="pencil" size={18} color={theme.whiteBase} />
          <Text style={[styles.actionText, { color: theme.whiteBase }]}>
            Edit
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, { borderColor: theme.error || "#ef4444" }]}
          onPress={() => onDelete(category.id)}
        >
          <Ionicons name="trash" size={18} color={theme.error || "#ef4444"} />
          <Text
            style={[styles.actionText, { color: theme.error || "#ef4444" }]}
          >
            Delete
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={onClose} style={styles.closeBtn}>
        <Ionicons name="close" size={28} color={theme.greyBasePrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingRight: 32, // Leave room for the absolute close button if needed
  },
  categoryName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  totalBadge: {
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  totalLabel: {
    fontSize: 12,
    textTransform: "uppercase",
  },
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
    gap: 8, // Adjust gap to ensure exactly 10 dots fit per row
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  dot: {
    width: 20, // 10 dots * 20px = 200px + gaps. Fits perfectly on mobile.
    height: 20,
    borderRadius: 10, // Perfect circle
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: "auto", // Pushes buttons to the bottom of the content area
  },
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
  actionText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  closeBtn: {
    position: "absolute",
    top: -10,
    right: -10,
    padding: 8,
  },
});
