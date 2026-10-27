import { View, StyleSheet, FlatList, Text, ViewToken } from "react-native";
import { useContext, useState, useCallback, useRef, useEffect } from "react";
import { FAB, Portal, Searchbar } from "react-native-paper";
import { Habit } from "@/types/habits";

import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { GoalCompletionModal } from "@/components/modal/goal-completion-modal";
import HabitHeatmap from "@/components/ui/habits/habit-heatmap";
import { useHabitForm } from "@/hooks/use-forms/use-habit-form";
import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { usePlaySound } from "@/hooks/use-play-sound";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";
import {
  addHabitWithEffects,
  checkInHabitWithEffects,
  freezeHabitWithEffects,
  restartHabitWithEffects,
  deleteHabitWithEffects,
  editHabitWithEffects,
} from "@/utils/Data-services/habit-services/habit-actions";
import { useHabitStore } from "@/stores/use-habit-store";
import { useShallow } from "zustand/shallow";
import { useDailyMetrics } from "@/stores/use-metrics-store";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  GlobalSearchFocusHighlight,
  GlobalSearchFocusHighlightRequest,
} from "@/components/ui/global-search/global-search-focus-highlight";

function HabitsScreenInner() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const dailyMetrics = useDailyMetrics();
  const [searchQuery, setSearchQuery] = useState("");
  const [visible, setVisible] = useState(false);
  const [visibleInEditMode, setVisibleInEditMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [completedHabit, setCompletedHabit] = useState<Habit | null>(null);
  const { showToast } = useDbErrorToast();
  const { triggerHaptic } = useHaptics();
  const habitListRef = useRef<FlatList<string>>(null);
  const pendingHabitFocusId = useRef<string | null>(null);
  const handledHabitFocusRequest = useRef<string | null>(null);
  const [habitToFocus, setHabitToFocus] = useState<string | null>(null);
  const router = useRouter();

  const {
    openAdd,
    openAddRequest,
    focusItemId,
    focusItemType,
    focusRequestId,
  } = useLocalSearchParams<{
    openAdd?: string;
    openAddRequest?: string;
    focusItemId?: string;
    focusItemType?: string;
    focusRequestId?: string;
  }>();

  const handledOpenAddRequest = useRef<string | null>(null);
  const { state, updateField, onSubmit } = useHabitForm({
    addHabit: addHabitWithEffects,
    editHabit: editHabitWithEffects,
    editingHabit,
    onClose: () => {
      setVisible(false);
      setVisibleInEditMode(false);
    },
  });
  const filteredHabitsIds = useHabitStore(
    useShallow((state) =>
      Object.values(state.habitsById)
        .filter((habit) =>
          habit.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .map((habit) => habit.id),
    ),
  );

  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const pendingHabitHighlight =
    useRef<GlobalSearchFocusHighlightRequest | null>(null);

  const [highlightedHabit, setHighlightedHabit] =
    useState<GlobalSearchFocusHighlightRequest | null>(null);

  const habitViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 15,
  }).current;

  const onHabitViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
      const pending = pendingHabitHighlight.current;

      if (
        !pending ||
        !viewableItems.some(
          (token) => token.isViewable && token.item === pending.id,
        )
      ) {
        return;
      }

      pendingHabitHighlight.current = null;
      setHighlightedHabit(pending);
    },
  ).current;
  const audioSource = require("@/assets/audio/habit-congrats-2.mp3");
  const audioPlayer = usePlaySound(audioSource, 0.5);
  const showModal = useCallback((habit?: Habit) => {
    if (habit) {
      setVisibleInEditMode(true);
      setVisible(true);
      setEditingHabit(habit);
      return;
    }
    setEditingHabit(null);
    setVisibleInEditMode(false);
    setVisible(true);
  }, []);
  const hideModal = useCallback(() => {
    setVisibleInEditMode(false);
    setVisible(false);
  }, []);

  const handleCheckin = useCallback(
    async (id: string) => {
      try {
        const status = await checkInHabitWithEffects(id);
        return status;
      } catch {
        showToast("Couldn't check in habit. Changes have been undone.");
      }
    },
    [checkInHabitWithEffects, showToast],
  );

  const handleFreeze = useCallback(
    async (id: string) => {
      try {
        const status = await freezeHabitWithEffects(id);
        return status;
      } catch {
        showToast("Couldn't freeze habit. Changes have been undone.");
      }
    },
    [freezeHabitWithEffects, showToast],
  );

  const handleDelete = useCallback(async () => {
    if (!habitToDelete) return;
    const id = habitToDelete;
    if (id === "") return;
    void deleteHabitWithEffects(id)
      .then(() => {
        triggerHaptic();
      })
      .catch(() => {
        showToast("Couldn't delete the habit. It has been restored.");
      })
      .finally(() => {
        setHabitToDelete(null);
      });
  }, [habitToDelete, showToast, triggerHaptic, deleteHabitWithEffects]);

  const handleGoalRestart = useCallback(
    (updated: Habit) => {
      restartHabitWithEffects(updated);
      setGoalModalVisible(false);
    },
    [restartHabitWithEffects],
  );

  const handleGoalReached = useCallback((habit: Habit) => {
    setCompletedHabit(habit);
    setGoalModalVisible(true);
    audioPlayer.seekTo(0);
    audioPlayer.play();
  }, []);

  const handleEditRow = useCallback(
    (id: string) => {
      const habit = useHabitStore.getState().habitsById[id];
      if (habit) showModal(habit);
    },
    [showModal],
  );

  const handleDeleteRow = useCallback((id: string) => {
    setHabitToDelete(id);
  }, []);

  const keyExtractor = useCallback((id: string) => id, []);

  const renderHabit = useCallback(
    ({ item: id }: { item: string }) => (
      <GlobalSearchFocusHighlight
        request={highlightedHabit?.id === id ? highlightedHabit : null}
        accentColor={theme.habitBase}
        borderRadius={14}
      >
        <HabitItem
          id={id}
          onCheckin={handleCheckin}
          onEdit={handleEditRow}
          onDelete={handleDeleteRow}
          onFreeze={handleFreeze}
          onGoalReached={handleGoalReached}
        />
      </GlobalSearchFocusHighlight>
    ),
    [
      handleCheckin,
      handleEditRow,
      handleDeleteRow,
      handleGoalReached,
      highlightedHabit,
    ],
  );

  const handleScrollToIndexFailed = useCallback(
    ({
      index,
      averageItemLength,
    }: {
      index: number;
      averageItemLength: number;
    }) => {
      const list = habitListRef.current;
      if (!list) return;

      // Approximate the item's location and allow the list to render there.
      list.scrollToOffset({
        offset: Math.max(0, averageItemLength * index),
        animated: false,
      });

      // Retry after the list has had an opportunity to measure more rows.
      setTimeout(() => {
        habitListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
          viewOffset: 8,
        });
      }, 120);
    },
    [],
  );

  useEffect(() => {
    if (
      focusItemType !== "habit" ||
      !focusItemId ||
      !focusRequestId ||
      handledHabitFocusRequest.current === focusRequestId
    ) {
      return;
    }

    handledHabitFocusRequest.current = focusRequestId;

    // Clear any existing Habits-screen search filter.
    setSearchQuery("");

    // Schedule scrolling once the list contains the requested habit.
    setHabitToFocus(focusItemId);

    pendingHabitHighlight.current = {
      id: focusItemId,
      requestId: focusRequestId,
    };

    // Consume this navigation request so it isn't replayed.
    router.setParams({
      focusItemId: undefined,
      focusItemType: undefined,
      focusRequestId: undefined,
    });
  }, [focusItemId, focusItemType, focusRequestId, router]);

  useEffect(() => {
    if (!habitToFocus) return;

    const index = filteredHabitsIds.indexOf(habitToFocus);

    // The store may still be loading, or the habit may no longer exist.
    // Keep the request pending until the item becomes available.
    if (index === -1) return;

    const frame = requestAnimationFrame(() => {
      const list = habitListRef.current;

      if (!list) return;

      list.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
        viewOffset: 8,
      });

      setHabitToFocus(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [habitToFocus, filteredHabitsIds]);

  const emptyStateColor = isDarkMode ? theme.habitBase : theme.habitDarkPrimary;
  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <FontAwesome6 name="bars-progress" size={60} color={emptyStateColor} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(emptyStateColor, "99") },
        ]}
      >
        This is your habits page
      </Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added habits will be shown here
      </Text>
      <View
        style={[
          emptyStateStyle.suggestionBox,
          { borderColor: withAlpha(emptyStateColor, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: emptyStateColor }]}
        >
          Habits can have daily and weekly goals with on specific days of the
          week
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: emptyStateColor }]}
        >
          1 Free streak freeze is given per habit, every 5 successive check-ins
          earn 1 additional freeze
        </Text>
      </View>
    </View>
  );
  useEffect(() => {
    if (
      openAdd !== "1" ||
      !openAddRequest ||
      handledOpenAddRequest.current === openAddRequest
    ) {
      return;
    }

    // Prevent this request from opening the modal more than once.
    handledOpenAddRequest.current = openAddRequest;

    showModal();

    // Clear the request so it won't be replayed on a later visit.
    router.setParams({
      openAdd: undefined,
      openAddRequest: undefined,
    });
  }, [openAdd, openAddRequest, router, showModal]);
  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Searchbar
          placeholder="Search Habits"
          onChangeText={setSearchQuery}
          rippleColor="#ffffff96"
          iconColor={theme.whiteBase}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: theme.habitBaseTrans }]}
          theme={{ colors: { onSurfaceVariant: theme.whiteBase } }}
        />
        <FlatList
          ref={habitListRef}
          data={filteredHabitsIds}
          showsVerticalScrollIndicator={false}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            dailyMetrics && <HabitHeatmap metrics={dailyMetrics} />
          }
          renderItem={renderHabit}
          ListEmptyComponent={EmptyState}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          viewabilityConfig={habitViewabilityConfig}
          onViewableItemsChanged={onHabitViewableItemsChanged}
        />
        <FAB
          color={theme.habitDarkPrimary}
          style={[
            styles.fab,
            {
              backgroundColor: theme.habitBase,
              borderColor: theme.habitDarkSecondary,
            },
          ]}
          icon="plus"
          onPress={() => showModal()}
        />
      </View>
      <Portal>
        <HabitModal
          visible={visible}
          visibleInEditMode={visibleInEditMode}
          onDismiss={hideModal}
          state={state}
          updateField={updateField}
          editingHabit={editingHabit}
          onSubmit={onSubmit}
        />
        {completedHabit && (
          <GoalCompletionModal
            visible={goalModalVisible}
            habit={completedHabit}
            onRestart={handleGoalRestart}
            onDelete={() => {
              if (completedHabit) setHabitToDelete(completedHabit.id);
              setGoalModalVisible(false);
            }}
            onDismiss={() => setGoalModalVisible(false)}
          />
        )}
      </Portal>
      <ConfirmDialog
        visible={habitToDelete !== null}
        title="Delete Log"
        description="Are you sure you want to delete this log?"
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => setHabitToDelete(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default function HabitsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const isReady = useScreenReady();
  if (!isReady) return <EntitySkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Habits">
      <HabitsScreenInner />
    </ScreenErrorBoundary>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    borderWidth: 1,
  },
  searchbar: {
    marginHorizontal: 4,
    marginVertical: 8,
    //height: "6%",
  },
});

const emptyStateStyle = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "20%", // Keeps it centered in the upper-middle
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  suggestionBox: {
    marginTop: 30,
    width: "100%",
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
  },
  suggestionText: {
    fontSize: 13,
    marginVertical: 5,
    textAlign: "center",
  },
});
