import React, { useEffect, useState, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { AchievementBadge as BadgeType } from "../types/achievements";
import AchievementBadge from "@/components/ui/achievements/achievement-badge";
import { ALL_ACHIEVEMENTS } from "@/types/achievements-ui";
import { useData } from "../hooks/use-data";
import { useTheme } from "@/hooks/use-theme-colors";

/**
 * TODO : Configure elevation styling for both dark and light mode
 * TODO : Hnadle hidden achievements
 */
export default function AchievementsScreen() {
  const { theme } = useTheme();
  const { targetBadgeId } = useLocalSearchParams<{ targetBadgeId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const itemOffsets = useRef<Record<string, number>>({}); // The Offset Dictionary
  const { unlockedAchievements, appMetrics } = useData();
  const [achievements, setAchievements] = useState(ALL_ACHIEVEMENTS);
  const [unlockedData, setUnlockedData] = useState<Record<string, BadgeType>>(
    {},
  );

  useEffect(() => {
    const loadBadges = async () => {
      // Convert array to a dictionary for O(1) lookups during rendering
      const unlockedMap: Record<string, BadgeType> = {};
      unlockedAchievements.forEach((badge) => {
        unlockedMap[badge.id] = badge;
      });
      setUnlockedData(unlockedMap);
      setAchievements((prevAchievements) => {
        return [...prevAchievements];
      });
    };
    loadBadges();
  }, [unlockedAchievements]); // Re-run if core data changes

  useEffect(() => {
    if (targetBadgeId) {
      // using a small timeout to ensure the layout has finished calculating
      const scrollTimeout = setTimeout(() => {
        const targetY = itemOffsets.current[targetBadgeId];

        if (targetY !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: targetY - 20, // -20 adds a nice little padding at the top of the screen
            animated: true,
          });
        }
      }, 300);

      return () => clearTimeout(scrollTimeout);
    }
  }, [targetBadgeId]);

  const unlockedBadgesCount = Object.keys(unlockedData).length;

  // Helper function to map an achievement ID to its current metric progress
  /*   const getProgressForBadge = (badgeId: string): number => {
    const achivement = ALL_ACHIEVEMENTS.find((a) => a.id === badgeId);
    if (!achivement) return 0;
    if (achivement.metricTrigger === "meta") return unlockedBadgesCount;
    else return appMetrics?.global[achivement.metricTrigger] || 0;
  }; */

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    > */}
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>
        {achievements.map((def) => {
          const unlockedInfo = unlockedData[def.id];
          const isUnlocked = !!unlockedInfo;
          /* def.id === "tasks_10" ||
            def.id === "habits_100" ||
            def.id === "timer_1440" ||
            def.id === "achievements_all"
              ? true
              : !!unlockedInfo; */
          const currentProgress =
            def.metricTrigger === "meta"
              ? unlockedBadgesCount
              : appMetrics?.global[def.metricTrigger] || 0;
          return (
            <View
              key={def.id}
              // Record the exact Y position of this item as it renders
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                itemOffsets.current[def.id] = y;
              }}
            >
              <AchievementBadge
                key={def.id}
                badge={def}
                isUnlocked={isUnlocked}
                unlockedAt={unlockedInfo?.unlockedAt}
                currentProgress={currentProgress as number}
              />
            </View>
          );
        })}
      </ScrollView>
      {/* <FlatList
        data={achievements}
        keyExtractor={(def) => def.id}
        contentContainerStyle={styles.content}
        renderItem={({ item: def }) => {
          const unlockedInfo = unlockedData[def.id];
          const isUnlocked = !!unlockedInfo;
          return (
            <AchievementBadge
              key={def.id}
              badge={def}
              isUnlocked={isUnlocked}
              unlockedAt={unlockedInfo?.unlockedAt}
              currentProgress={getProgressForBadge(def.id)}
            />
          );
        }}
      /> */}
      {/* </SafeAreaView> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
});
