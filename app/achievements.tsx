import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import AchievementBadge from "@/components/ui/achievements/achievement-badge";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ALL_ACHIEVEMENTS } from "@/types/achievements-ui";
import { useData } from "../hooks/context-hooks/use-data";
import { AchievementBadge as BadgeType } from "../types/achievements";

export default function AchievementsScreen() {
  const { theme } = useTheme();
  const { targetBadgeId } = useLocalSearchParams<{ targetBadgeId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const itemOffsets = useRef<Record<string, number>>({}); // The Offset Dictionary
  const { unlockedAchievements, appMetrics, achievementMetrics } = useData();
  const [achievements, setAchievements] = useState(ALL_ACHIEVEMENTS);

  /*   useEffect(() => {
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
  }, [unlockedAchievements]); // Re-run if core data changes */

  const unlockedData = useMemo(() => {
    const map: Record<string, BadgeType> = {};
    unlockedAchievements.forEach((badge) => {
      map[badge.id] = badge;
    });
    return map;
  }, [unlockedAchievements]);

  const achievementsWithProgress = useMemo(() => {
    return achievements.map((def) => {
      const unlockedInfo = unlockedData[def.id];
      const isUnlocked = !!unlockedInfo;
      let metricValue = 0;
      let baseLineValue = 0;
      if (def.metricTrigger !== "meta") {
        metricValue = appMetrics?.global[def.metricTrigger] || 0;
        baseLineValue = achievementMetrics[def.metricTrigger] || 0;
      }
      const currentProgress =
        def.metricTrigger === "meta"
          ? Object.keys(unlockedData).length
          : metricValue - baseLineValue;
      return { def, unlockedInfo, isUnlocked, currentProgress };
    });
  }, [achievements, unlockedData, appMetrics, achievementMetrics]);

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
        {achievementsWithProgress.map((achievement) => {
          /* const unlockedInfo = unlockedData[def.id];
          const isUnlocked = !!unlockedInfo;
          let metricValue = 0;
          let baseLineValue = 0;
          if (def.metricTrigger !== "meta") {
            metricValue = appMetrics?.global[def.metricTrigger] || 0;
            baseLineValue = achievementMetrics[def.metricTrigger] || 0;
          }
          const currentProgress =
            def.metricTrigger === "meta"
              ? unlockedBadgesCount
              : metricValue - baseLineValue; */
          return (
            <View
              key={achievement.def.id}
              // Record the exact Y position of this item as it renders
              style={{
                backgroundColor: "transparent",
                marginBottom: 5,
                marginTop: 5,
              }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                itemOffsets.current[achievement.def.id] = y;
              }}
            >
              <AchievementBadge
                key={achievement.def.id}
                badge={achievement.def}
                isUnlocked={achievement.isUnlocked}
                unlockedAt={achievement.unlockedInfo?.unlockedAt}
                currentProgress={achievement.currentProgress as number}
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
