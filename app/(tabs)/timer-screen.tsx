import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ViewToken,
} from "react-native";

import { Portal, TextInput } from "react-native-paper";

import TimerDisplay from "@/components/ui/timer-logs/time-display/time-display";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { XButton } from "@/components/ui/shared/x-button";
import TimerEditModal from "@/components/modal/timer-modal";
import { ThemeContext } from "@/context/ThemeContext";
import { formatDuration } from "@/utils/Timer-utils/timer-math";
import { TimerLog } from "@/types/timer";
import { getTodayISO, withAlpha, getWeekStartISO } from "@/utils/common-utils";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { Category } from "@/types/category";
import { CategoryBadge } from "@/components/ui/shared/categories/category-badge";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";
import { timerLogStats, useTimerLogStore } from "@/stores/use-timerLog-store";
import { useShallow } from "zustand/shallow";
import {
  deleteLogWithEffects,
  editLogWithEffects,
} from "@/utils/Data-services/timerlog-services/log-actions";
import {
  selectCategoryList,
  useCategoryStore,
} from "@/stores/use-category-store";
import { useTimerStore } from "@/stores/use-timer-store";
import {
  lapTimerWithEffects,
  pauseTimerWithEffects,
  requestResetTimer,
  saveAndResetTimerWithEffects,
  setTimerCountdownTarget,
  setTimerTitle,
  startTimerWithEffects,
  stopTimerWithEffects,
  toggleTimerModeWithEffects,
} from "@/utils/Data-services/timer-services/timer-actions";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  GlobalSearchFocusHighlight,
  GlobalSearchFocusHighlightRequest,
} from "@/components/ui/global-search/global-search-focus-highlight";
// Note : Timescreen is the only component where value prop is used for the TextInput instead of defaultValue
// Note ContinuedFromAbove: default Value only takes input once, then doesnt update, the reason its works in other places is because
// Note ContinuedFromAbove: the modals re-render everytime, so default value gets feeded the latest state value and it looks ok,
// Note ContinuedFromAbove: here though the text inputs are directly on the screen so default value doesnt update with the state change

function TimerScreenInner() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const timerLogs = useTimerLogStore(
    useShallow((state) => Object.keys(state.logsById)),
  );
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  //const categories = useCategoryStore(useShallow(selectCategoryList));
  //const addLog = (log : TimerLog) => setTimerLogs([...timerLogs, log]);

  const title = useTimerStore((state) => state.title);
  const isRunning = useTimerStore((state) => state.isRunning);
  const mode = useTimerStore(useShallow((state) => state.mode));
  const countdownTarget = useTimerStore((state) => state.countdownTarget);
  const laps = useTimerStore(useShallow((state) => state.laps));
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<TimerLog>();
  const { showToast } = useDbErrorToast();
  const { triggerHaptic } = useHaptics();
  const logListRef = useRef<FlatList<string>>(null);
  // const pendingLogFocusId = useRef<string | null>(null);
  const handledLogFocusRequest = useRef<string | null>(null);
  const handledStartTimerRequest = useRef<string | null>(null);
  const [logToFocus, setLogToFocus] = useState<string | null>(null);
  const [isFocusLoading, setIsFocusLoading] = useState(false);
  const pendingLogHighlight = useRef<GlobalSearchFocusHighlightRequest | null>(
    null,
  );

  const [highlightedLog, setHighlightedLog] =
    useState<GlobalSearchFocusHighlightRequest | null>(null);

  const {
    openAdd,
    openAddRequest,
    focusItemId,
    focusItemType,
    focusRequestId,
    startTimerRequestId,
  } = useLocalSearchParams<{
    openAdd?: string;
    openAddRequest?: string;
    focusItemId?: string;
    focusItemType?: string;
    focusRequestId?: string;
    startTimerRequestId?: string;
  }>();
  const router = useRouter();
  const handledOpenAddRequest = useRef<string | null>(null);

  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  const { todayTotal, weekTotal, topCategoryId } = useTimerLogStore(
    useShallow((state) => {
      return timerLogStats(state);
    }),
  );
  var topCategory = null;

  const handleDelete = useCallback(async () => {
    if (!logToDelete) return;
    const id = logToDelete;
    try {
      await deleteLogWithEffects(id);
      triggerHaptic();
      setLogToDelete(null);
    } catch {
      setLogToDelete(null);
      showToast("Couldn't delete the log. It has been restored.");
    }
  }, [triggerHaptic, setLogToDelete, showToast]);

  const handleEditViaModal = useCallback(
    async (log: TimerLog) => {
      setModalVisible(false);
      setEditingLog(undefined);
      await editLogWithEffects(log);
    },
    [editLogWithEffects],
  );

  const showModal = useCallback((log: TimerLog) => {
    setEditingLog(log);
    setModalVisible(true);
  }, []);

  // 2. Derive the currently visible slice of data based on the page number
  const displayedLogs = useMemo(() => {
    return timerLogs.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [timerLogs, currentPage]);

  const handleLoadMore = useCallback(() => {
    // Only increment if we haven't reached the end of the array
    if (displayedLogs.length < timerLogs.length) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [displayedLogs.length, timerLogs.length]);

  const timerBaseColor = isDarkMode
    ? theme.timerBase
    : theme.timerBaseLightModeOnly;

  const handleEditRow = useCallback(
    (id: string) => {
      const log = useTimerLogStore.getState().logsById[id];
      if (log) showModal(log);
    },
    [showModal],
  );

  const handleDeleteRow = useCallback((id: string) => {
    setLogToDelete(id);
  }, []);

  const keyExtractor = useCallback((id: string) => id, []);

  const renderTimerLog = useCallback(
    ({ item: id }: { item: string }) => (
      <GlobalSearchFocusHighlight
        request={highlightedLog?.id === id ? highlightedLog : null}
        accentColor={theme.timerBase}
        borderRadius={14}
      >
        <TimerLogItem
          logId={id}
          onDelete={handleDeleteRow}
          onEdit={handleEditRow}
        />
      </GlobalSearchFocusHighlight>
    ),
    [handleEditRow, handleDeleteRow, highlightedLog],
  );

  const handleScrollToIndexFailed = useCallback(
    ({
      index,
      averageItemLength,
    }: {
      index: number;
      averageItemLength: number;
    }) => {
      const list = logListRef.current;
      if (!list) return;

      // Approximate the item's location and allow the list to render there.
      list.scrollToOffset({
        offset: Math.max(0, averageItemLength * index),
        animated: false,
      });

      // Retry after the list has had an opportunity to measure more rows.
      setTimeout(() => {
        logListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
          viewOffset: 8,
        });
      }, 120);
    },
    [],
  );

  const logViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
  }).current;

  // Keep the callback identity stable because FlatList expects a stable
  // onViewableItemsChanged callback.
  const handleLogViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
      //const pendingId = pendingLogFocusId.current;
      const pending = pendingLogHighlight.current;
      //console.log("pendingId", pendingId);
      if (!pending) return;

      const targetIsVisible = viewableItems.some(
        (token) => token.item === pending.id,
      );

      if (targetIsVisible) {
        //pendingLogFocusId.current = null;
        pendingLogHighlight.current = null;
        setHighlightedLog(pending);
        setIsFocusLoading(false);
      }
    },
  ).current;

  useEffect(() => {
    if (
      focusItemType !== "log" ||
      !focusItemId ||
      !focusRequestId ||
      handledLogFocusRequest.current === focusRequestId
    ) {
      return;
    }

    handledLogFocusRequest.current = focusRequestId;
    //pendingLogFocusId.current = focusItemId;
    pendingLogHighlight.current = {
      id: focusItemId,
      requestId: focusRequestId,
    };
    setLogToFocus(focusItemId);

    router.setParams({
      focusItemId: undefined,
      focusItemType: undefined,
      focusRequestId: undefined,
    });
  }, [focusItemId, focusItemType, focusRequestId, router]);
  //console.log("logToFocus", logToFocus);

  useEffect(() => {
    if (!logToFocus) return;

    const index = timerLogs.indexOf(logToFocus);

    // The store may still be loading, or the log may no longer exist.
    // Keep the request pending until the item becomes available.
    if (index === -1) return;
    // Expand the paginated data so the requested index is valid
    // in the FlatList's actual data prop.
    const requiredPage = Math.floor(index / ITEMS_PER_PAGE) + 1;

    if (currentPage < requiredPage) {
      setIsFocusLoading(true);
      setCurrentPage(requiredPage);
      return;
    }

    // Guard against scrolling before the target is present in data.
    if (index >= displayedLogs.length) return;

    const frame = requestAnimationFrame(() => {
      const list = logListRef.current;

      if (!list) return;

      list.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
        viewOffset: 8,
      });

      setLogToFocus(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [logToFocus, timerLogs, currentPage, displayedLogs.length]);

  useEffect(() => {
    if (
      !startTimerRequestId ||
      handledStartTimerRequest.current === startTimerRequestId
    ) {
      return;
    }

    handledStartTimerRequest.current = startTimerRequestId;

    // Don't toggle or restart an already-running timer.
    if (!useTimerStore.getState().isRunning) {
      startTimerWithEffects();
    }

    router.setParams({
      startTimerRequestId: undefined,
    });
  }, [startTimerRequestId, router]);
  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <Ionicons name="timer" size={60} color={timerBaseColor} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(timerBaseColor, "99") },
        ]}
      >
        This is your timer logs page
      </Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added logs will be shown here
      </Text>
      <View
        style={[
          emptyStateStyle.suggestionBox,
          { borderColor: withAlpha(timerBaseColor, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: timerBaseColor }]}
        >
          Logs can have categories and also have lap details
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: timerBaseColor }]}
        >
          You can switch mode to countdown by long pressing the clock
        </Text>
      </View>
    </View>
  );
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Stats row (checkpoint 10) ── */}
      <View style={styles.statsRow}>
        <StatCell
          label="Today"
          value={formatDuration(todayTotal)}
          accent={timerBaseColor}
        />
        <View
          style={[
            styles.statDivider,
            { backgroundColor: withAlpha(timerBaseColor, "33") },
          ]}
        />
        <StatCell
          label="This week"
          value={formatDuration(weekTotal)}
          accent={timerBaseColor}
        />
        {topCategory && (
          <>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: withAlpha(timerBaseColor, "33") },
              ]}
            />
            <StatCell
              label="Top category"
              value={topCategory}
              accent={timerBaseColor}
            />
          </>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextInput
          placeholder="Activity name"
          value={title}
          textColor={theme.text}
          onChangeText={setTimerTitle}
          style={[styles.input, { backgroundColor: theme.background }]}
          mode="outlined"
          theme={{
            colors: {
              onSurfaceVariant: withAlpha(timerBaseColor, "90"),
            },
          }}
          activeOutlineColor={theme.timerBase}
          outlineColor={timerBaseColor}
        />
      </View>

      <TimerDisplay
        mode={mode}
        countdownTarget={countdownTarget}
        isRunning={isRunning}
        onToggleMode={toggleTimerModeWithEffects}
        onCountdownTargetChange={setTimerCountdownTarget}
      />
      {/* Mode hint below the circle 
          <Text style={[styles.modeHint, { color: theme.timerBase }]}>
            {isRunning
              ? ""
              : `Hold circle to switch to ${mode === "stopwatch" ? "countdown" : "stopwatch"}`}
          </Text>*/}
      <View style={styles.buttons}>
        {!isRunning ? (
          <XButton
            icon="play"
            mode="timer"
            size="big"
            onPress={() => {
              triggerHaptic();
              startTimerWithEffects();
            }}
          />
        ) : (
          <>
            <XButton
              icon="pause"
              mode="timer"
              size="big"
              onPress={pauseTimerWithEffects}
            />
            <XButton
              icon="stop"
              mode="timer"
              size="big"
              onPress={async () => {
                triggerHaptic();
                const log = await stopTimerWithEffects();
                if (log) showModal(log);
              }}
            />
            {mode === "stopwatch" && (
              <XButton
                icon="flag"
                mode="timer"
                size="big"
                onPress={lapTimerWithEffects}
              />
            )}
            <XButton
              icon="refresh"
              mode="timer"
              size="big"
              onPress={requestResetTimer}
            />
          </>
        )}
      </View>
      {/* ── Lap splits inline display ── */}
      {laps.length > 0 && (
        <View
          style={[
            styles.lapsContainer,
            { borderColor: withAlpha(timerBaseColor, "33") },
          ]}
        >
          {laps.map((lapTime, idx) => {
            const splitDuration = idx === 0 ? lapTime : lapTime - laps[idx - 1];
            return (
              <View key={idx} style={styles.lapRow}>
                <Text
                  style={[
                    styles.lapLabel,
                    { color: withAlpha(timerBaseColor, "99") },
                  ]}
                >
                  Lap {idx + 1}
                </Text>
                <Text style={[styles.lapValue, { color: timerBaseColor }]}>
                  {formatDuration(splitDuration)}
                </Text>
                <Text
                  style={[
                    styles.lapTotal,
                    { color: withAlpha(timerBaseColor, "66") },
                  ]}
                >
                  {formatDuration(lapTime)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.logDividerContainer}>
        <View
          style={[
            styles.logDividerLine,
            { backgroundColor: withAlpha(timerBaseColor, "99") },
          ]}
        />
        <Text style={[styles.logDividerLabel, { color: timerBaseColor }]}>
          Recent Logs
        </Text>
        <View
          style={[
            styles.logDividerLine,
            { backgroundColor: withAlpha(timerBaseColor, "99") },
          ]}
        />
      </View>
      <View style={styles.logListContainer}>
        <FlatList
          ref={logListRef}
          data={displayedLogs}
          keyExtractor={keyExtractor}
          style={styles.logList}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5} // Triggers when user is halfway through the last visible screen
          initialNumToRender={15} // How many items to render in the exact first batch
          maxToRenderPerBatch={15} // Limits the amount rendered per scroll chunk to keep JS thread fast
          windowSize={5} // (Default is 21) Lowering this saves RAM by unmounting views far off-screen
          renderItem={renderTimerLog}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          onViewableItemsChanged={handleLogViewableItemsChanged}
          viewabilityConfig={logViewabilityConfig}
          ListEmptyComponent={EmptyState}
          ListFooterComponent={() => {
            if (displayedLogs.length >= timerLogs.length) return null;
            return (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" />
              </View>
            );
          }}
        />
        {isFocusLoading && (
          <View
            pointerEvents="auto"
            style={[
              styles.logFocusOverlay,
              {
                backgroundColor: withAlpha(theme.background, "CC"),
                borderColor: withAlpha(timerBaseColor, "35"),
              },
            ]}
          >
            <ActivityIndicator size="large" color={timerBaseColor} />

            <Text style={[styles.logFocusOverlayText, { color: theme.text }]}>
              Preparing logs…
            </Text>
          </View>
        )}
      </View>
      <Portal>
        {editingLog && (
          <TimerEditModal
            visible={modalVisible}
            log={editingLog}
            onDismiss={() => {
              setModalVisible(false);
              setEditingLog(undefined);
            }}
            onSave={handleEditViaModal}
          />
        )}
      </Portal>
      <ConfirmDialog
        visible={logToDelete !== null}
        title="Delete Log"
        description="Are you sure you want to delete this log?"
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => setLogToDelete(null)}
        onConfirm={handleDelete}
      />
    </View>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent: string;
}) {
  return (
    <View style={styles.statCell}>
      {typeof value === "string" ? (
        <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      ) : (
        <View>
          <CategoryBadge categoryId={value} />
        </View>
      )}
      <Text style={[styles.statLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

export default function TimerScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const isReady = useScreenReady();
  if (!isReady) return <EntitySkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Timer">
      <TimerScreenInner />
    </ScreenErrorBoundary>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: "center" },
  buttons: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",

    marginBottom: 8,
  },
  statCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  statDivider: { width: 2.5, marginVertical: 4 },

  input: { width: "100%", marginBottom: 10, marginHorizontal: 8 },

  categoryRow: { width: "100%", marginBottom: 6 },
  categoryInput: { marginBottom: 10 },
  suggestionChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 10,
  },
  suggestionText: { fontSize: 12, fontWeight: "600" },
  modeHint: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  lapsContainer: {
    width: "95%",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  lapLabel: { fontSize: 12, flex: 1 },
  lapValue: { fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" },
  lapTotal: { fontSize: 11, flex: 1, textAlign: "right" },

  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  logDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logDividerLine: {
    flex: 1, // each line takes equal remaining space
    height: 1,
  },
  logDividerLabel: {
    marginHorizontal: 6,
    fontSize: 14,
    fontWeight: "600",
  },
  logListContainer: {
    flex: 1,
    width: "95%",
    minHeight: 0,
    position: "relative",
  },

  logList: {
    flex: 1,
    width: "100%",
  },

  logFocusOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
  },

  logFocusOverlayText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
  },
});

const emptyStateStyle = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "5%",
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
