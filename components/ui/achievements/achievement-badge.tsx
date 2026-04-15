import React from "react";
import { View, StyleSheet , Text} from "react-native";
import {  Surface, useTheme as usePaperTheme, ProgressBar } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { AchievementDefinition } from "@/types/achievements-ui";
import { useTheme } from "@/hooks/use-theme-colors";

interface AchievementBadgeProps {
  badge: AchievementDefinition;
  isUnlocked: boolean;
  unlockedAt?: string;
  currentProgress: number;
}

function AchievementBadge({
  badge,
  isUnlocked,
  unlockedAt,
  currentProgress,
}: AchievementBadgeProps) {
  const paperTheme = usePaperTheme();
  const { theme, isDarkMode } = useTheme();

  const getTierColor = () => {
    if (!isUnlocked) return paperTheme.colors.outlineVariant; // Tone-deaf/muted gray for locked
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
        return paperTheme.colors.primary;
    }
  };

  const tierColor = getTierColor();
  // Ensure progress doesn't exceed 1 (100%)
  const progressRatio = Math.min(currentProgress / badge.target, 1);

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? theme.taskDarkPrimary : theme.greyTimeline,//paperTheme.colors.elevation.level5,
          shadowColor: paperTheme.colors.elevation.level1
         },
        //! Elevation background color : paperTheme.colors.elevation.level2
        !isUnlocked && styles.lockedContainer, // Apply opacity if locked
      ]}
      elevation={isUnlocked ? 5 : 0} // Flatten the elevation if locked
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
            style={[
              styles.title,
              {
                color: isUnlocked
                  ? theme.text
                  : theme.greyBasePrimary,
              },
            ]}
          >
            {badge.title}
          </Text>
          {!isUnlocked && (
            <Text
              style={[styles.textVariant, { color: paperTheme.colors.outline }]}
            >
              {badge.title.includes("timer")
                ? `${Math.floor(currentProgress / 60)}/${badge.target / 60}`
                : `${currentProgress} / ${badge.target}`}
            </Text>
          )}
        </View>
        {isUnlocked && (
          <Text
            style={[styles.description, { color: theme.taskBase }]}
          >
            "{badge.unlockedDescription}"
          </Text>
        )}
        <Text
          style={[
            styles.description,
            { color: theme.text, marginBottom: 8 },
          ]}
        >
          {badge.description}
        </Text>

        {!isUnlocked && (
          <ProgressBar
            progress={progressRatio}
            color={isUnlocked ? tierColor : paperTheme.colors.outlineVariant}
            style={styles.progressBar}
          />
        )}

        {isUnlocked && unlockedAt && (
          <Text
            style={[styles.date, { color:theme.taskBase}]}
          >
            Unlocked: {new Date(unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </Surface>
  );
}
export default React.memo(AchievementBadge);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
   // marginBottom: 12,
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
    fontSize: 16,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
  },
  date: {
    marginTop: 6,
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: 500,
  },
  description: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 16

  },
  textVariant: {
    fontSize: 11,
    fontWeight: 500,
  },
});
