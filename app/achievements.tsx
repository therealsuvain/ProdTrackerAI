import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import AchievementBadge from "@/components/ui/achievements/achievement-badge";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ALL_ACHIEVEMENTS } from "@/types/achievements-ui";
import { AchievementBadge as BadgeType } from "../types/achievements";
import {
  selectUnlockedList,
  useAchievementStore,
} from "@/stores/use-achievement-store";
import { useShallow } from "zustand/shallow";
import { useMetricStore } from "@/stores/use-metrics-store";
import {
  GlobalSearchFocusHighlight,
  GlobalSearchFocusHighlightRequest,
} from "@/components/ui/global-search/global-search-focus-highlight";

export default function AchievementsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const itemOffsets = useRef<Record<string, number>>({}); // The Offset Dictionary
  const unlockedAchievements = useAchievementStore(
    useShallow(selectUnlockedList),
  );
  const metricBasline = useAchievementStore((state) => state.baseline);
  const metricGlobal = useMetricStore((state) => state.global);
  console.log("metricGlobal", metricGlobal.tasksCompleted);
  console.log("metricBasline", metricBasline.tasksCompleted);
  const [achievements, setAchievements] = useState(ALL_ACHIEVEMENTS);
  //Add a state (or ref) to hold whichever badge we are waiting to scroll to
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const { targetBadgeId, focusItemId, focusItemType, focusRequestId } =
    useLocalSearchParams<{
      targetBadgeId: string;
      focusItemId?: string;
      focusItemType?: string;
      focusRequestId?: string;
    }>();
  const handledAchievementFocusRequest = useRef<string | null>(null);
  const itemHeights = useRef<Record<string, number>>({});

  const pendingAchievementHighlight =
    useRef<GlobalSearchFocusHighlightRequest | null>(null);

  const [highlightedAchievement, setHighlightedAchievement] =
    useState<GlobalSearchFocusHighlightRequest | null>(null);

  const achievementsScrollY = useRef(0);
  const achievementsViewportHeight = useRef(0);

  const maybeHighlightVisibleAchievement = useCallback(() => {
    const pending = pendingAchievementHighlight.current;
    if (!pending) return;

    const y = itemOffsets.current[pending.id];
    const height = itemHeights.current[pending.id];
    const viewportHeight = achievementsViewportHeight.current;

    if (y === undefined || height === undefined || viewportHeight <= 0) {
      return;
    }

    const viewportTop = achievementsScrollY.current;
    const viewportBottom = viewportTop + viewportHeight;

    const isVisible = y + height > viewportTop && y < viewportBottom;

    if (!isVisible) return;

    pendingAchievementHighlight.current = null;
    setHighlightedAchievement(pending);
  }, []);
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
        metricValue = metricGlobal[def.metricTrigger] || 0;
        baseLineValue = metricBasline[def.metricTrigger] || 0;
      }
      const currentProgress =
        def.metricTrigger === "meta"
          ? Object.keys(unlockedData).length
          : metricValue - baseLineValue;
      return { def, unlockedInfo, isUnlocked, currentProgress };
    });
  }, [achievements, unlockedData, metricGlobal, metricBasline]);

  // Make scrollToAchievement return a boolean indicating if it succeeded
  const scrollToAchievement = useCallback((id: string): boolean => {
    const targetY = itemOffsets.current[id];

    // IMPORTANT: Check for undefined, NOT !targetY (because the 1st item has y === 0!)
    if (targetY === undefined || !scrollViewRef.current) {
      return false;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetY - 20),
        animated: true,
      });
    });

    return true;
  }, []);

  /*   useEffect(() => {
    if (targetBadgeId) {
      // using a small timeout to ensure the layout has finished calculating
      const scrollTimeout =
        setTimeout(() => {
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
  }, [targetBadgeId]); */

  useEffect(() => {
    if (targetBadgeId) {
      setPendingScrollId(targetBadgeId);
      router.setParams({ targetBadgeId: undefined });
      return;
    }

    if (
      focusItemType !== "achievement" ||
      !focusItemId ||
      !focusRequestId ||
      handledAchievementFocusRequest.current === focusRequestId
    ) {
      return;
    }

    const exists = achievementsWithProgress.some(
      (achievement) => achievement.def.id === focusItemId,
    );

    // Keep the request pending if achievement data is not ready yet.
    if (!exists) return;

    handledAchievementFocusRequest.current = focusRequestId;
    setPendingScrollId(focusItemId);
    // Reuse the screen's existing scroll-to-achievement behavior.
    scrollToAchievement(focusItemId);
    pendingAchievementHighlight.current = {
      id: focusItemId,
      requestId: focusRequestId,
    };

    router.setParams({
      focusItemId: undefined,
      focusItemType: undefined,
      focusRequestId: undefined,
    });
  }, [
    focusItemId,
    focusItemType,
    focusRequestId,
    achievementsWithProgress,
    router,
  ]);
  const unlockedBadgesCount = Object.keys(unlockedData).length;

  //Try to scroll immediately if offsets are already cached in memory (2nd+ visit)
  useEffect(() => {
    if (!pendingScrollId) return;

    const didScroll = scrollToAchievement(pendingScrollId);
    if (didScroll) {
      setPendingScrollId(null); // Clear once scrolled!
    }
  }, [pendingScrollId, scrollToAchievement]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    > */}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={(event) => {
          achievementsScrollY.current = event.nativeEvent.contentOffset.y;
          maybeHighlightVisibleAchievement();
        }}
        onLayout={(event) => {
          achievementsViewportHeight.current = event.nativeEvent.layout.height;
          maybeHighlightVisibleAchievement();
        }}
      >
        {achievementsWithProgress.map((achievement) => {
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
                const { y, height } = event.nativeEvent.layout;
                const id = achievement.def.id;
                itemOffsets.current[id] = y;
                itemHeights.current[id] = height;
                //SOTA Handshake: If this is the exact item we are waiting for on 1st load, scroll now!
                if (pendingScrollId === id) {
                  if (scrollToAchievement(id)) {
                    setPendingScrollId(null);
                  }
                }
                requestAnimationFrame(maybeHighlightVisibleAchievement);
              }}
            >
              <GlobalSearchFocusHighlight
                request={
                  highlightedAchievement?.id === achievement.def.id
                    ? highlightedAchievement
                    : null
                }
                accentColor={"white"}
                borderRadius={14}
              >
                <AchievementBadge
                  key={achievement.def.id}
                  badge={achievement.def}
                  isUnlocked={achievement.isUnlocked}
                  unlockedAt={achievement.unlockedInfo?.unlockedAt}
                  currentProgress={achievement.currentProgress as number}
                />
              </GlobalSearchFocusHighlight>
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
