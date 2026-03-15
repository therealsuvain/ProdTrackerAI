import React, { useEffect, useState, useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadUnlockedAchievements } from "@/utils/storage-utils";
import { AchievementBadge as BadgeType } from "../types/achievements";
import AchievementBadge from "@/components/ui/achievements/achievement-badge";
import {
  ALL_ACHIEVEMENTS,
  TASK_ACHIEVEMENTS,
  HABIT_ACHIEVEMENTS,
  TIMER_ACHIEVEMENTS,
  ACHIEVEMENTS_ACHIEVEMENTS,
} from "@/types/achievements-ui";
import { useData } from "../hooks/use-data";
import { useTheme } from "@/hooks/use-theme-colors";

/** 
* TODO : Configure elevation styling for both dark and light mode
*/
export default function AchievementsScreen() {
  const {theme} = useTheme();
  const { tasks, habits , appMetrics} = useData();
  const [achievements, setAchievements] = useState(ALL_ACHIEVEMENTS);
  const [unlockedData, setUnlockedData] = useState<Record<string, BadgeType>>(
    {},
  );

  useEffect(() => {
    const loadBadges = async () => {
      const unlocked = await loadUnlockedAchievements();
      // Convert array to a dictionary for O(1) lookups during rendering
      const unlockedMap: Record<string, BadgeType> = {};
      unlocked.forEach((badge) => {
        unlockedMap[badge.id] = badge;
      });
      setUnlockedData(unlockedMap);
      setAchievements((prevAchievements) => {
        return [...prevAchievements]
      });
    };
    loadBadges();
  }, [appMetrics]); // Re-run if core data changes

  // Calculate live metrics
  const completedTasksCount = appMetrics?.global.tasksCompleted || 0;
  const completedHabitsCount = appMetrics?.global.habitsCheckedIn || 0;
  const unlockedBadgesCount = Object.keys(unlockedData).length;

  // Helper function to map an achievement ID to its current metric progress
  const getProgressForBadge = (badgeId: string): number => {
    const achivement = ALL_ACHIEVEMENTS.find((a) => a.id === badgeId);
    if (!achivement) 
      return 0;
    if(achivement.metricTrigger === "meta") 
      return unlockedBadgesCount;
    else
      return appMetrics?.global[achivement.metricTrigger] || 0;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.achievementslabel, { color: theme.text }]}>
        Achievements
      </Text>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        {achievements.map((def) => {
          const unlockedInfo = unlockedData[def.id];
          const isUnlocked = !! unlockedInfo;
            /* def.id === "tasks_10" ||
            def.id === "habits_100" ||
            def.id === "timer_1440" ||
            def.id === "achievements_all"
              ? true
              : !!unlockedInfo; */

          return (
            <AchievementBadge
              key={def.id}
              badge={def}
              isUnlocked={isUnlocked}
              unlockedAt={unlockedInfo?.unlockedAt}
              currentProgress={getProgressForBadge(def.id)}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
    achievementslabel: {
    marginLeft: 10,
    fontSize: 35,
    fontWeight: "bold",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
});
