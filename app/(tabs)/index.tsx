import { ScrollView, StyleSheet, View } from "react-native";
import React, { useCallback, useContext, useMemo, useState } from "react";
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

import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import EventItem from "@/components/ui/calendar-events/event-item";
import { ChatScreen } from "@/components/ui/chat/chat-screen";
import HabitItem from "@/components/ui/habits/habit-item";
import UnifiedTimeline from "@/components/ui/home-timeline/home-timeline";
import { SearchResults } from "@/components/ui/search-results";
import TaskItem from "@/components/ui/tasks/task-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { ThemeContext } from "@/context/ThemeContext";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { useNotifications } from "@/hooks/use-notifications";
import { useSearch } from "@/hooks/use-search";
import { selectedDateTaskIds, useTaskStore } from "@/stores/use-task-store";
import { getTodayISO } from "@/utils/common-utils";
import { useFlapAnimation } from "@/hooks/animations/use-flap-animation-new";
import { useHaptics } from "@/hooks/use-haptics";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useIsFocused } from "@react-navigation/native";
import { toggleTaskWithEffects } from "@/utils/Data-services/task-services/task-actions";
import { checkInHabitWithEffects } from "@/utils/Data-services/habit-services/habit-actions";
import { useHabitStore } from "@/stores/use-habit-store";

const EMPTY_IDS: string[] = [];

function HomeScreenInner() {
  const { triggerHaptic } = useHaptics();
  const { theme } = useContext(ThemeContext);
  const { showToast } = useDbErrorToast();
  const isFocused = useIsFocused();
  const { events } = useEvents();
  const { timerLogs } = useLogs();
  const [searchVisible, setSearchVisible] = useState(false);
  const { query, performSearch, results } = useSearch();
  const [aiVisible, setAiVisible] = useState(false);
  useNotifications();
  const [viewMode, setViewMode] = useState<"overview" | "timeline">("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const todayDate = useMemo(() => getTodayISO(), [isFocused]);
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

  let upcomingEvents = events.slice(0, 3);
  let activeHabits = useHabitStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;
      return Object.values(state.habitsById).map((habit) => habit.id);
    }),
  ).slice(0, 3);
  /* let activeHabits: string[] = []; */
  let recentLogs = timerLogs.slice(0, 3);
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
      {/* {(isLoading || isProcessing) && <LoadingIndicator />} */}
      <View style={{ backgroundColor: theme.background }}>
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
              uncheckedColor: theme.text,
              checkedColor: theme.blueLightPrimary,
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
              uncheckedColor: theme.text,
              checkedColor: theme.blueLightPrimary,
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
      </View>
      {viewMode === "overview" ? (
        <ScrollView style={{ backgroundColor: theme.background }}>
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

          {/*    <Animated.Text
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
          </Animated.Text> */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.taskBase,
              },
            ]}
          >
            Today's Task
          </Text>
          {todaysTaskIds.length > 0 ? (
            todaysTaskIds.map((taskId) => (
              <TaskItem
                key={taskId}
                id={taskId}
                onToggleComplete={toggleTaskCompleted}
              />
            ))
          ) : (
            <Text style={{ color: theme.taskBase }}>No task Today</Text>
          )}
          <Divider style={styles.divider} />

          {/*           <Animated.Text
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
          </Animated.Text> */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.eventBase,
              },
            ]}
          >
            Upcoming Events
          </Text>
          {upcomingEvents.length ? (
            upcomingEvents.map((event) => (
              <EventItem key={event.id} event={event}></EventItem>
            ))
          ) : (
            <Text style={{ color: theme.eventBase }}>No Upcoming Events</Text>
          )}
          <Divider style={styles.divider} />

          {/*           <Animated.Text
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
          </Animated.Text> */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.timerBase,
              },
            ]}
          >
            Recent Timer Logs
          </Text>
          {recentLogs.length ? (
            recentLogs.map((log) => (
              <TimerLogItem
                key={log.id}
                log={log}
                onDelete={() => {}}
                onEdit={() => {}}
              />
            ))
          ) : (
            <Text style={{ color: theme.timerBase }}>No Recent Logs</Text>
          )}
          <Divider style={styles.divider} />

          {/*           <Animated.Text
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
          </Animated.Text> */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.habitBase,
              },
            ]}
          >
            Active Habits
          </Text>
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
            <Text style={{ color: theme.habitBase }}>No Active Habits</Text>
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
          {/* <AIVoiceModal
            visible={aiVisible}
            onDismiss={() => setAiVisible(false)}
            IntentProcessor={processCommand}
          /> */}

          {/* {!isLoading && (
            <IntentConfirmationModal
              intent={intent}
              onConfirm={confirmExecute}
            />
          )} */}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.timelineContainer,
            { backgroundColor: theme.background },
          ]}
        >
          {/* Date selector */}
          <View style={styles.dateSelector}>
            <Button
              icon="chevron-left"
              labelStyle={{
                fontWeight: "condensedBold",
                fontSize: 16,
                color: theme.blueDarkPrimary,
                textShadowColor: theme.text,
                textShadowRadius: 0.1,
                textShadowOffset: { width: 0, height: 0.1 },
              }}
              onPress={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
            >
              {/*               <Text
                style={{
                  color: theme.blueDarkPrimary,
                  textShadowColor: theme.text,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 0,
                }}
              >
                Previous
              </Text> */}
              Previous
            </Button>
            <Button
              mode="contained"
              buttonColor={theme.blueDarkPrimary}
              textColor={theme.whiteBase}
              onPress={() => setSelectedDate(new Date())}
            >
              {isSelectedDateToday ? "Today" : selectedDate.toDateString()}
            </Button>
            <Button
              icon="chevron-right"
              labelStyle={{
                fontWeight: "condensedBold",
                fontSize: 16,
                color: theme.blueDarkPrimary,
                textShadowColor: "#ffffffa9",
                textShadowRadius: 0.1,
                textShadowOffset: { width: 0, height: 0.1 },
              }}
              onPress={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDate(newDate);
              }}
            >
              Next
            </Button>
          </View>

          <UnifiedTimeline
            events={events}
            timerLogs={timerLogs}
            selectedDate={selectedDate}
            onTaskToggle={toggleTaskCompleted}
            onHabitCheckIn={handleHabitUpdate}
          />
        </View>
      )}
      <FAB
        style={styles.fab}
        color="white"
        icon="brain"
        onPress={() => setAiVisible(true)}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 16,
    backgroundColor: "grey",
  },
});
