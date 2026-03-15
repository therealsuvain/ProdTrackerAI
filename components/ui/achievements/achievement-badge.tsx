import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, Surface, useTheme, ProgressBar } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { AchievementDefinition } from "@/types/achievements-ui";

interface AchievementBadgeProps {
  badge: AchievementDefinition;
  isUnlocked: boolean;
  unlockedAt?: string;
  currentProgress: number;
}

export default function AchievementBadge({
  badge,
  isUnlocked,
  unlockedAt,
  currentProgress,
}: AchievementBadgeProps) {
  const theme = useTheme();

  const getTierColor = () => {
    if (!isUnlocked) return theme.colors.outlineVariant; // Tone-deaf/muted gray for locked
    switch (badge.tier) {
      case "diamond":
        return "#C71585";
      case "platinum":
        return "#E5E4E2";
      case "gold":
        return "#D4AF37";
      case "silver":
        return "#C0C0C0";
      case "bronze":
        return "#CD7F32";
      default:
        return theme.colors.primary;
    }
  };

  const tierColor = getTierColor();
  // Ensure progress doesn't exceed 1 (100%)
  const progressRatio = Math.min(currentProgress / badge.target, 1);

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: theme.colors.elevation.level2 }, // ! Elevation background color : theme.colors.elevation.level2
        !isUnlocked && styles.lockedContainer, // Apply opacity if locked
      ]}
      elevation={isUnlocked ? 2 : 0} // Flatten the elevation if locked
    >
      <View style={[styles.iconRing, { borderColor: tierColor }]}>
        <Ionicons
          name={isUnlocked ? "trophy" : "lock-closed"}
          size={28}
          color={tierColor}
        />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text
            variant="titleMedium"
            style={[
              styles.title,
              {
                color: isUnlocked
                  ? theme.colors.onSurface
                  : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {badge.title}
          </Text>
          {!isUnlocked && (
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              {badge.title.includes("timer")
                ? `${Math.floor(currentProgress / 60)}/${badge.target / 60}`
                : `${currentProgress} / ${badge.target}`}
            </Text>
          )}
        </View>
        {isUnlocked && (
          <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
            "{badge.unlockedDescription}"
          </Text>
        )}
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
        >
          {badge.description}
        </Text>

        {!isUnlocked && (
          <ProgressBar
            progress={progressRatio}
            color={isUnlocked ? tierColor : theme.colors.outlineVariant}
            style={styles.progressBar}
          />
        )}

        {isUnlocked && unlockedAt && (
          <Text
            variant="labelSmall"
            style={[styles.date, { color: theme.colors.primary }]}
          >
            Unlocked: {new Date(unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
  },
  lockedContainer: {
    opacity: 0.6, // Mutes the entire component
    borderWidth: 1,
    borderColor: "rgba(150, 150, 150, 0.2)", // Subtle border instead of shadow
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontWeight: "700",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
  },
  date: {
    marginTop: 6,
    fontStyle: "italic",
  },
});
