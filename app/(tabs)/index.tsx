import { Pressable, StyleSheet, Keyboard, View } from "react-native";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Animated from "react-native-reanimated";
import {
  Button,
  Divider,
  FAB,
  Portal,
  Provider,
  Text,
} from "react-native-paper";
import { useShallow } from "zustand/react/shallow";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import EventItem from "@/components/ui/calendar-events/event-item";
import { ChatScreen } from "@/components/ui/chat/chat-screen";
import HabitItem from "@/components/ui/habits/habit-item";
import UnifiedTimeline from "@/components/ui/home-timeline/home-timeline";
import TaskItem from "@/components/ui/tasks/task-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { ThemeContext } from "@/context/ThemeContext";
import { useNotifications } from "@/hooks/use-notifications";
import { useSearch } from "@/hooks/use-search";
import { selectedDateTaskIds, useTaskStore } from "@/stores/use-task-store";
import { getTodayISO, withAlpha } from "@/utils/common-utils";
import { useHaptics } from "@/hooks/use-haptics";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { toggleTaskWithEffects } from "@/utils/Data-services/task-services/task-actions";
import { checkInHabitWithEffects } from "@/utils/Data-services/habit-services/habit-actions";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { useEventStore } from "@/stores/use-event-store";
import { useSync } from "@/context/SyncContext";
import LoadingIndicator from "@/components/shared/loading-indicator";
import {
  useFlapScroll,
  useFlapTitle,
} from "@/hooks/animations/use-flap-scroll";
import {
  HomeAllEmptyState,
  HomeEmptyStateCard,
} from "@/components/ui/home/empty-states";
import { GlobalSearchScreen } from "@/components/ui/global-search/global-search-screen";
import { SearchResult } from "@/utils/search-utils";
import type { GlobalSearchSelectionRequest } from "@/types/global-search";
import { dispatchGlobalSearchSelection } from "@/utils/Search-utils/selection-dispatcher";
import { resolveEventOccurrenceDate } from "@/utils/Search-utils/resolve-event-occurence";

const EMPTY_IDS: string[] = [];

function HomeScreenInner() {
  const { triggerHaptic } = useHaptics();
  const { theme } = useContext(ThemeContext);
  const { showToast } = useDbErrorToast();
  const isFocused = useIsFocused();
  const [searchVisible, setSearchVisible] = useState(false);
  const { query, performSearch, results } = useSearch();
  const [aiVisible, setAiVisible] = useState(false);
  useNotifications();
  const [viewMode, setViewMode] = useState<"overview" | "timeline">("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const todayDate = useMemo(() => getTodayISO(), [isFocused]);
  const { isSyncing } = useSync();
  const router = useRouter();
  const HOME_ROUTES = {
    tasks: "/(tabs)/task-screen",
    calendar: "/(tabs)/calendar-screen",
    habits: "/(tabs)/habits-screen",
    timer: "/(tabs)/timer-screen",
  } as const;

  /*   const SEARCH_RESULT_ROUTES: Record<SearchResult["type"], string> = {
    task: "/(tabs)/task-screen",
    event: "/(tabs)/calendar-screen",
    habit: "/(tabs)/habits-screen",
    log: "/(tabs)/timer-screen",
  }; */
  const isSelectedDateToday = useMemo(
    () => selectedDate.toDateString() === todayDate,
    [selectedDate, todayDate],
  );

  const todaysTaskIds = useTaskStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;

      return selectedDateTaskIds(state, todayDate);
    }),
  );

  let activeHabits = useHabitStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;
      return Object.values(state.habitsById).map((habit) => habit.id);
    }),
  ).slice(0, 3);

  let upcomingEvents = useEventStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;

      return Object.values(state.eventsById)
        .map((event) => event.id)
        .slice(0, 3);
    }),
  );

  let recentLogs = useTimerLogStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;
      return Object.values(state.logsById)
        .map((log) => log.id)
        .slice(0, 3);
    }),
  );

  // Launch anim values
  /* 
  const todayFlap = useFlapAnimation({
    launchDelay: 0,
    intervalMs: 15000,
    triggerOffset: 0,
  });
  const eventsFlap = useFlapAnimation({
    launchDelay: 200,
    intervalMs: 15000,
    triggerOffset: 6000,
  });
  const timerLogsFlap = useFlapAnimation({
    launchDelay: 400,
    intervalMs: 15000,
    triggerOffset: 12000,
  });
  const habitsFlap = useFlapAnimation({
    launchDelay: 600,
    intervalMs: 15000,
    triggerOffset: 18000,
  }); */
  /* const DebugAuthProbe = () => {
    const { authLoaded, userId, isAnonymous } = useAuth();
    console.log("[DebugAuthProbe]", { authLoaded, userId, isAnonymous });
    return null;
  }; */
  // in HomeScreenInner, replacing the commented-out block:
  const flapScroll = useFlapScroll();
  const todayFlap = useFlapTitle(flapScroll);
  const eventsFlap = useFlapTitle(flapScroll);
  const timerLogsFlap = useFlapTitle(flapScroll);
  const habitsFlap = useFlapTitle(flapScroll);

  const allSectionsEmpty =
    todaysTaskIds.length === 0 &&
    upcomingEvents.length === 0 &&
    activeHabits.length === 0 &&
    recentLogs.length === 0;

  const navigateToAddScreen = useCallback(
    (
      pathname:
        | typeof HOME_ROUTES.tasks
        | typeof HOME_ROUTES.calendar
        | typeof HOME_ROUTES.habits,
    ) => {
      router.push({
        pathname,
        params: {
          openAdd: "1",
          openAddRequest: String(Date.now()),
        },
      });
    },
    [router],
  );

  const openAddTask = useCallback(
    () => navigateToAddScreen(HOME_ROUTES.tasks),
    [navigateToAddScreen],
  );

  const openAddEvent = useCallback(
    () => navigateToAddScreen(HOME_ROUTES.calendar),
    [navigateToAddScreen],
  );

  const openAddHabit = useCallback(
    () => navigateToAddScreen(HOME_ROUTES.habits),
    [navigateToAddScreen],
  );

  const openTimer = useCallback(() => {
    router.navigate(HOME_ROUTES.timer);
  }, [router]);

  /*   const handleSearchResultPress = useCallback(
    (result: SearchResult) => {
      setSearchVisible(false);

      router.navigate({
        pathname: SEARCH_RESULT_ROUTES[result.type] as never,
        params: {
          focusItemId: String(result.item.id),
          focusItemType: result.type,
          focusRequestId: String(Date.now()),
        },
      } as never);
    },
    [router],
  ); */
  const handleSearchResultPress = useCallback(
    (request: GlobalSearchSelectionRequest) => {
      let requestToDispatch = request;

      if (request.target.kind === "event") {
        const event = useEventStore.getState().eventsById[request.target.id];

        const occurrenceDate = event
          ? resolveEventOccurrenceDate(event, getTodayISO())
          : null;

        if (!event || !occurrenceDate) {
          showToast("This event has no valid occurrence to open.");
          return;
        }

        requestToDispatch = {
          ...request,
          context: {
            ...request.context,
            occurrenceDate,
          },
        };
      }

      const handled = dispatchGlobalSearchSelection(requestToDispatch, {
        navigate: ({ pathname, params, withAnchor }) => {
          const href = {
            pathname: pathname as never,
            params,
          } as never;

          if (withAnchor) {
            router.push(href, { withAnchor: true });
          } else {
            router.navigate(href);
          }
        },

        onUnsupportedTarget: (target) => {
          console.warn(
            `[Global Search] No selection handler registered for "${target.kind}" yet.`,
          );
        },
      });

      // Leave search open if a target isn't supported yet.
      if (handled) {
        setSearchVisible(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (viewMode === "overview") flapScroll.reset(); // ScrollView remounts at offset 0
  }, [viewMode]);

  const toggleTaskCompleted = useCallback(
    async (id: string) => {
      void toggleTaskWithEffects(id);
      triggerHaptic();
    },
    [toggleTaskWithEffects, triggerHaptic],
  );
  const handleHabitUpdate = useCallback(
    async (id: string) => {
      try {
        const status = await checkInHabitWithEffects(id);
        return status;
      } catch (e) {
        showToast("Couldn't check in habit. Changes have been undone.");
      }
    },
    [checkInHabitWithEffects],
  );
  //DebugAuthProbe();
  return (
    <Provider>
      {isSyncing && <LoadingIndicator />}
      <View
        style={{ paddingTop: 10, flex: 1, backgroundColor: theme.background }}
      >
        {viewMode === "overview" ? (
          allSectionsEmpty ? (
            <HomeAllEmptyState
              backgroundColor={theme.background}
              accentColor={theme.taskBase}
              textColor={theme.text}
              onViewTimeline={() => setViewMode("timeline")}
              actions={[
                {
                  id: "tasks",
                  icon: "checkbox-marked-circle-outline",
                  title: "Today's Tasks",
                  subtitle: "Add a task for today",
                  accentColor: theme.taskBase,
                  onPress: openAddTask,
                },
                {
                  id: "events",
                  icon: "calendar-blank-outline",
                  title: "Upcoming Events",
                  subtitle: "Make room for something important",
                  accentColor: theme.eventBase,
                  onPress: openAddEvent,
                },
                {
                  id: "habits",
                  icon: "sprout",
                  title: "Active Habits",
                  subtitle: "Build a routine, one step at a time",
                  accentColor: theme.habitBase,
                  onPress: openAddHabit,
                },
                {
                  id: "timer",
                  icon: "timer-outline",
                  title: "Timer Sessions",
                  subtitle: "Start a focused session",
                  accentColor: theme.timerBase,
                  onPress: openTimer,
                },
              ]}
            />
          ) : (
            <Animated.ScrollView
              style={{ backgroundColor: theme.background }}
              onScroll={flapScroll.scrollHandler}
              scrollEventThrottle={16}
              onLayout={flapScroll.onViewportLayout}
            >
              {/* <Searchbar
                style={{
                  marginVertical: 4,
                  marginRight: 60,
                  backgroundColor: theme.taskBaseTransToo,
                }}
                placeholder="Search Everything"
                onChangeText={performSearch}
                value={query}
              />
              {query.trim().length > 0 && (
                <Button
                  onPress={() => {
                    Keyboard.dismiss();
                    setSearchVisible(true);
                  }}
                >
                  View Results ({results.length})
                </Button>
              )} */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Search Everything"
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchVisible(true);
                }}
                style={({ pressed }) => [
                  styles.searchLauncher,
                  { backgroundColor: theme.taskBaseTransToo },
                  pressed && styles.searchLauncherPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="magnify"
                  size={28}
                  color={withAlpha(theme.text, "D9")}
                />

                <View style={styles.searchLauncherCopy}>
                  <Text
                    variant="titleMedium"
                    numberOfLines={1}
                    style={{ color: theme.text, fontWeight: "500" }}
                  >
                    Search Everything
                  </Text>

                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={{ color: withAlpha(theme.text, "A8") }}
                  >
                    Tasks, tags, achievements, settings...
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={23}
                  color={withAlpha(theme.text, "A8")}
                />
              </Pressable>

              <Animated.Text
                onLayout={todayFlap.onLayout}
                style={[
                  styles.sectionTitle,
                  todayFlap.animatedStyle,
                  {
                    color: theme.taskBase,
                  },
                ]}
              >
                Today's Task
              </Animated.Text>
              {/* <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.taskBase,
              },
            ]}
          >
            Today's Task
          </Text> */}
              {todaysTaskIds.length > 0 ? (
                todaysTaskIds.map((taskId) => (
                  <TaskItem
                    key={taskId}
                    id={taskId}
                    onToggleComplete={toggleTaskCompleted}
                  />
                ))
              ) : (
                <HomeEmptyStateCard
                  icon="checkbox-multiple-marked-outline"
                  accentColor={theme.taskBase}
                  textColor={theme.text}
                  title="A fresh page"
                  description="Nothing planned for today. Add one small win to get started."
                  actionLabel="Add task"
                  onPress={openAddTask}
                />
              )}
              <Divider style={styles.divider} />

              <Animated.Text
                onLayout={eventsFlap.onLayout}
                style={[
                  styles.sectionTitle,
                  eventsFlap.animatedStyle,
                  {
                    color: theme.eventBase,
                  },
                ]}
              >
                Upcoming Events
              </Animated.Text>
              {/*  <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.eventBase,
              },
            ]}
          >
            Upcoming Events
          </Text> */}
              {upcomingEvents.length ? (
                upcomingEvents.map((eventId) => (
                  <EventItem key={eventId} id={eventId}></EventItem>
                ))
              ) : (
                <HomeEmptyStateCard
                  icon="calendar-month-outline"
                  accentColor={theme.eventBase}
                  textColor={theme.text}
                  title="Room to breathe"
                  description="No upcoming events. Your schedule is open."
                  actionLabel="Schedule event"
                  onPress={openAddEvent}
                />
              )}
              <Divider style={styles.divider} />

              <Animated.Text
                onLayout={timerLogsFlap.onLayout}
                style={[
                  styles.sectionTitle,
                  timerLogsFlap.animatedStyle,
                  {
                    color: theme.timerBase,
                  },
                ]}
              >
                Recent Timer Logs
              </Animated.Text>
              {/* <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.timerBase,
              },
            ]}
          >
            Recent Timer Logs
          </Text> */}
              {recentLogs.length ? (
                recentLogs.map((log) => (
                  <TimerLogItem
                    key={log}
                    logId={log}
                    onDelete={() => {}}
                    onEdit={() => {}}
                  />
                ))
              ) : (
                <HomeEmptyStateCard
                  icon="timer-settings-outline"
                  accentColor={theme.timerBase}
                  textColor={theme.text}
                  title="Ready when you are"
                  description="No timer sessions logged yet. Start a focused session whenever you're ready."
                  actionLabel="Start a session"
                  onPress={openTimer}
                />
              )}
              <Divider style={styles.divider} />

              <Animated.Text
                onLayout={habitsFlap.onLayout}
                style={[
                  styles.sectionTitle,
                  habitsFlap.animatedStyle,
                  {
                    color: theme.habitBase,
                  },
                ]}
              >
                Active Habits
              </Animated.Text>
              {/* <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.habitBase,
              },
            ]}
          >
            Active Habits
          </Text> */}
              {activeHabits.length ? (
                activeHabits.map((id) => (
                  <HabitItem
                    key={id}
                    id={id}
                    onCheckin={handleHabitUpdate}
                    onDelete={() => 0}
                    onEdit={() => 0}
                  />
                ))
              ) : (
                <HomeEmptyStateCard
                  icon="sprout"
                  accentColor={theme.habitBase}
                  textColor={theme.text}
                  title="Growth starts small"
                  description="Start building a routine, one repeatable action at a time."
                  actionLabel="Add a habit"
                  onPress={openAddHabit}
                />
              )}
              <Divider style={styles.divider} />
            </Animated.ScrollView>
          )
        ) : (
          <View
            style={[
              styles.timelineContainer,
              { backgroundColor: theme.background },
            ]}
          >
            {/* Date selector */}
            <View style={styles.dateSelector}>
              <Pressable
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
                style={({ pressed }) => {
                  return {
                    opacity: pressed ? 0.5 : 1,
                  };
                }}
              >
                <Ionicons
                  name="chevron-back-circle-sharp"
                  size={36}
                  color="white"
                />
              </Pressable>
              <Button
                mode="elevated"
                // buttonColor={theme.blueDarkPrimary}
                textColor={theme.whiteBase}
                onPress={() => setSelectedDate(new Date())}
              >
                {isSelectedDateToday ? "Today" : selectedDate.toDateString()}
              </Button>

              <Pressable
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
                style={({ pressed }) => {
                  return {
                    opacity: pressed ? 0.5 : 1,
                  };
                }}
              >
                <Ionicons
                  name="chevron-forward-circle-sharp"
                  size={36}
                  color="white"
                />
              </Pressable>
            </View>

            <UnifiedTimeline
              selectedDate={selectedDate}
              onTaskToggle={toggleTaskCompleted}
              onHabitCheckIn={handleHabitUpdate}
            />
          </View>
        )}
      </View>
      <GlobalSearchScreen
        visible={searchVisible}
        query={query}
        results={results}
        onQueryChange={performSearch}
        onDismiss={() => setSearchVisible(false)}
        onItemPress={handleSearchResultPress}
      />
      <FAB
        style={styles.fab}
        variant="surface"
        color="white"
        icon="brain"
        size="medium"
        onPress={() => setAiVisible(true)}
      />
      <FAB
        style={styles.fabTimeline}
        variant="surface"
        color="white"
        size="small"
        icon={viewMode === "overview" ? "menu-open" : "view-dashboard"}
        onPress={() =>
          viewMode === "overview"
            ? setViewMode("timeline")
            : setViewMode("overview")
        }
      />
      {aiVisible && (
        <Portal>
          <ChatScreen
            visible={aiVisible}
            onDismiss={() => setAiVisible(false)}
          />
        </Portal>
      )}
    </Provider>
  );
}
export default function HomeScreen() {
  return (
    <ScreenErrorBoundary screenName="Home">
      <HomeScreenInner />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: {
    marginLeft: 5,
    fontSize: 32,
    fontWeight: "500",
    // IMPORTANT: backfaceVisibility prevents the text "disappearing"
    // when rotateX goes past 90deg during the slap
    backfaceVisibility: "hidden",
  },
  divider: { marginVertical: 16 },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewSwitcher: { marginVertical: 12 },
  timelineContainer: { flex: 1 },
  dateSelector: {
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  searchLauncher: {
    flex: 1,
    marginHorizontal: 8,
    marginRight: 60,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  searchLauncherCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  searchLauncherPressed: {
    opacity: 0.78,
  },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 16,
    borderRadius: 30,
    backgroundColor: "#0000004f",
    borderColor: "white",
    borderWidth: 0.5,
  },

  fabTimeline: {
    position: "absolute",
    top: 20,
    right: 16,
    borderRadius: 20,
    borderColor: "white",
    borderWidth: 0.25,
    backgroundColor: "transparent",
  },
});
