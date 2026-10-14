import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
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
  Modal,
  Portal,
  Provider,
  Searchbar,
  SegmentedButtons,
  Text,
} from "react-native-paper";
import { useShallow } from "zustand/react/shallow";
import { useRouter } from "expo-router";

import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import EventItem from "@/components/ui/calendar-events/event-item";
import { ChatScreen } from "@/components/ui/chat/chat-screen";
import HabitItem from "@/components/ui/habits/habit-item";
import UnifiedTimeline from "@/components/ui/home-timeline/home-timeline";
import { SearchResults } from "@/components/ui/search-results";
import TaskItem from "@/components/ui/tasks/task-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { ThemeContext } from "@/context/ThemeContext";
import { useNotifications } from "@/hooks/use-notifications";
import { useSearch } from "@/hooks/use-search";
import { selectedDateTaskIds, useTaskStore } from "@/stores/use-task-store";
import { getTodayISO, withAlpha } from "@/utils/common-utils";
import { useFlapAnimation } from "@/hooks/animations/use-flap-animation-new";
import { useHaptics } from "@/hooks/use-haptics";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useIsFocused } from "@react-navigation/native";
import { toggleTaskWithEffects } from "@/utils/Data-services/task-services/task-actions";
import { checkInHabitWithEffects } from "@/utils/Data-services/habit-services/habit-actions";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { useEventStore } from "@/stores/use-event-store";
import { useSync } from "@/context/SyncContext";
import LoadingIndicator from "@/components/shared/loading-indicator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { sqlite } from "@/db";
import {
  useFlapScroll,
  useFlapTitle,
} from "@/hooks/animations/use-flap-scroll";
import {
  HomeAllEmptyState,
  HomeEmptyStateCard,
} from "@/components/ui/home/empty-states";
import { set } from "date-fns";
import { Ionicons } from "@expo/vector-icons";

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
  //if (isSyncing) return <LoadingIndicator />;
  return (
    <Provider>
      {isSyncing && <LoadingIndicator />}

      {/*       <View style={{ backgroundColor: theme.background }}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={(value) =>
            setViewMode(value as "overview" | "timeline")
          }
          buttons={[
            {
              value: "overview",
              label: "Overview",
              icon: "view-dashboard",
              style: {
                backgroundColor:
                  viewMode === "overview"
                    ? theme.blueDarkPrimary
                    : "transparent",
              },
            },
            {
              value: "timeline",
              label: "Today's Timeline",
              icon: "timeline",
              style: {
                backgroundColor:
                  viewMode === "timeline"
                    ? theme.blueDarkPrimary
                    : "transparent",
              },
            },
          ]}
          style={[styles.viewSwitcher, { backgroundColor: theme.background }]}
        />
      </View> */}
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
              <Searchbar
                style={{
                  marginVertical: 4,
                  backgroundColor: theme.taskBaseTransToo,
                }}
                placeholder="Search Everything"
                onChangeText={performSearch}
                value={query}
              />
              {results.length > 0 && (
                <Button onPress={() => setSearchVisible(true)}>
                  {" "}
                  View Results ({results.length})
                </Button>
              )}

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
              <Portal>
                <Modal
                  visible={searchVisible}
                  onDismiss={() => setSearchVisible(false)}
                >
                  <SearchResults
                    results={results}
                    onItemPress={(result) => {
                      setSearchVisible(false);
                    }}
                  />
                </Modal>
              </Portal>
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
              {/* <Button
                icon="chevron-left"
                labelStyle={{
                  fontWeight: "condensedBold",
                  fontSize: 30,
                  color: theme.blueDarkPrimary,
                  textShadowColor: theme.text,
                  //textShadowRadius: 0.1,
                  //textShadowOffset: { width: 0, height: 0.1 },
                }}
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setSelectedDate(newDate);
                }}
              >
                
              </Button> */}
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
              {/*  <Button
                icon="chevron-right"
                style={{
                  marginLeft: 20,
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderColor: theme.blueDarkPrimary,
                  borderWidth: 2,
                }}
                labelStyle={{
                  fontWeight: "condensedBold",
                  fontSize: 30,
                  color: theme.blueDarkPrimary,
                  textShadowColor: "#ffffffa9",
                  //textShadowRadius: 0.1,
                  //textShadowOffset: { width: 0, height: 0.1 },
                }}
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
              >
                {" "}
              </Button> */}
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
      <FAB
        style={styles.fab}
        color="white"
        icon="brain"
        onPress={() => setAiVisible(true)}
      />
      <FAB
        style={styles.fabTimeline}
        variant="surface"
        color="white"
        size="small"
        icon={
          viewMode === "overview" ? "timeline-clock-outline" : "view-dashboard"
        }
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
  fab: {
    position: "absolute",
    bottom: 80,
    right: 16,
    backgroundColor: "grey",
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
