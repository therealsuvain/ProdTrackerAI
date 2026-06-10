import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { AchievementDefinition } from "@/types/achievements-ui";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProgressBar, useTheme as usePaperTheme } from "react-native-paper";

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
    if (!isUnlocked) return theme.greyBasePrimary; // Tone-deaf/muted gray for locked
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
        return theme.blueLightPrimary;
    }
  };

  const tierColor = getTierColor();
  // Ensure progress doesn't exceed 1 (100%)
  const progressRatio = Math.min(currentProgress / badge.target, 1);

  const surfaceStyle = isDarkMode
    ? {
        backgroundColor: theme.taskDarkPrimary, // #1e1c20
        shadowColor: theme.whiteBase,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 12, // Android elevation
      }
    : {
        backgroundColor: theme.greyTimeline, // #ffffff (light mode white card)
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 8,
      };

  return (
    <View
      style={[
        styles.container,
        isUnlocked && surfaceStyle,
        /*  {
          backgroundColor: isDarkMode
            ? theme.taskDarkPrimary
            : theme.greyTimeline, //paperTheme.colors.elevation.level5,
          shadowColor: paperTheme.colors.elevation.level1,
        }, */
        //! Elevation background color : paperTheme.colors.elevation.level2
        !isUnlocked && styles.lockedContainer, // Apply opacity if locked
        {
          backgroundColor: isDarkMode
            ? theme.taskDarkPrimary
            : theme.greyTimeline,
        },
      ]}
      //elevation={isUnlocked ? 5 : 0} // Flatten the elevation if locked
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
                color: isUnlocked ? theme.text : theme.greyBasePrimary,
              },
            ]}
          >
            {badge.title}
          </Text>
          {!isUnlocked && (
            <Text
              style={[styles.textVariant, { color: theme.greyBasePrimary }]}
            >
              {badge.title.includes("timer")
                ? `${Math.floor(currentProgress / 60)}/${badge.target / 60}`
                : `${currentProgress} / ${badge.target}`}
            </Text>
          )}
        </View>
        {isUnlocked && (
          <Text style={[styles.description, { color: theme.taskBase }]}>
            "{badge.unlockedDescription}"
          </Text>
        )}
        <Text
          style={[styles.description, { color: theme.text, marginBottom: 8 }]}
        >
          {badge.description}
        </Text>

        {!isUnlocked && (
          <ProgressBar
            progress={progressRatio}
            color={isUnlocked ? tierColor : theme.greyBasePrimary}
            style={styles.progressBar}
          />
        )}

        {isUnlocked && unlockedAt && (
          <Text style={[styles.date, { color: theme.taskBase }]}>
            Unlocked: {new Date(unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
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
    lineHeight: 16,
  },
  textVariant: {
    fontSize: 11,
    fontWeight: 500,
  },
});
