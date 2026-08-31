import { ScrollView, StyleSheet, View } from "react-native";
import React, { useCallback, useContext, useState } from "react";
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

import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import { AnalyticsSection } from "@/components/ui/analytics-section";
import EventItem from "@/components/ui/calendar-events/event-item";
import { ChatScreen } from "@/components/ui/chat/chat-screen";
import HabitItem from "@/components/ui/habits/habit-item";
import UnifiedTimeline from "@/components/ui/home-timeline";
import { SearchResults } from "@/components/ui/search-results";
import TaskItem from "@/components/ui/tasks/task-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { ThemeContext } from "@/context/ThemeContext";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { useNotifications } from "@/hooks/use-notifications";
import { useSearch } from "@/hooks/use-search";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { Habit } from "@/types/habits";
import { getTodayISO } from "@/utils/common-utils";
import { useFlapAnimation } from "@/hooks/animations/use-flap-animation-new";
import { useData } from "@/hooks/context-hooks/use-data";
import { useHaptics } from "@/hooks/use-haptics";
import { GlobalMetricKey } from "@/types/metrics";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useAuth } from "@/context/AuthContext";

/**
 * TODOOptim 2 : Many files are very large, try and make it more modular. ALL FILES HAVE TO CHECKED FOR POSSIBLE <REFACTORS></REFACTORS>
 * TODOAdd 5 : Pay wall, barring paid features for free users
 * TODOAdd 6 : Notifications edits via AI chat
 * TODOAdd 7 : Maybe custom notifications options
 * TODOOptim 10 : new Date() is expensive in javascript so have be to memomized everywhere
 * TODOAdd 11 : Input sanitization
 * TODOAdd 12 : Check for Security enhancements and possible securicty concerns for the entire app
 * TODOX 14: Timer Screen Flip Animation state issues- FIX'em
 * TODOAdd 18 : Achievements Badges generation, maybe pixelated or sprite version of meme refered by the achievment phrase
 * TODOX 21 : Codebase updation for iOS
 * TODOX 22 : Testing on bigger/smaller screens. Test on different devices
 * TODOX 23 : home page search enhancment or removal. R&D
 * TODOX 25 : Habit successful checkin feedback
 * TODOADD 27 : R&D better Calendar screen, refer google calendar maybe.
 * TODOX 31 : If tags and categoires are added, embeddings for them?, atleast searchable via physical search, AI handlers also would need to be updated
 * TODOX 34 : Maybe keep darkMode as default irrespective of system settings
 * TODOAdd 35 : Item Label(Home-screen Today's tasks , events, habits etc) animations, like ads
 * TODOAdd 36 : Mayeb add more animations for the app. R&D
 * TODOAdd 37 : More settings options
 * TODOAdd 38 : Few more achievements
 * TODOOptim 65 : Check for steps required to adapte date/time fields to different Timezones and day light saving time changes
 * TODOX : Confirmation Diagloue for data deletion/reseting in settings
 * TODO : Home page search is broken right now
 * TODO : Every Modal must have close button and must close on pressing back
 * TODO : Habit auto freeze should be optional and toggleable
 * TODO : The AI chat always has to have chat history avaliable to it,
 * TODO : habits checkins missed recording duplicates, some id checker is needed for those habits form whom the metric is incremented alrteady and prevent duplicate increments
 * for example I asked the current chat logic , "how to read a scatter plot", it gave a base explannation on what a scatter plot is
 * but not how to read it, in the follow up , I asked , "yea, but how to read it tho", it answered some bullshit and asked me what
 * "it" is . It forgot what I said before.
 * TODO : Migrate to Interaction API for googlegenAI lib
 * TODO : Infitely recurring evnets currently are only replicated for 60 days, after that their UI card is not shown in the calendar
 * TODO : Achievment Badge notifciation out of bounds on smaller or lower resolution screens, almost all views have to be checked for screen size specific issues
 * TODO : notification badge for items with notifcation, pressing on the badge should allow to disable notifications for that item
 * TODO : Completed task deletion, either prompt or auto delete after 30 days
 * TODO : Calendar item re-design
 * TODO : All erro handling , every where.
 * TODO : If no cloud data then dont open prompt for mrege or replace, function to check if cloud has data but there is sequencing problem.
 * TODO : Custom colors for categories currently only local to devices and dont sync to cloud
 * TODO : Analytics - if filter leads to no data for that filter, empty tiles are displaed, isntead display soem message or hide tiles or something
 * TODO : If due date of task is changed, the notification should be updated, or user should be told to reschedule the notification or something, same with events, probably not habit
 *
 *
 */

function HomeScreenInner() {
  const { triggerHaptic } = useHaptics();
  const { trackMetric } = useData();
  const { theme } = useContext(ThemeContext);
  const { showToast } = useDbErrorToast();
  const { tasks, toggleTask } = useTasks();
  const { events } = useEvents();
  const { timerLogs } = useLogs();
  const { habits, editHabit } = useHabits();
  const [searchVisible, setSearchVisible] = useState(false);
  const { query, performSearch, results } = useSearch();
  const [aiVisible, setAiVisible] = useState(false);
  useNotifications();
  const [viewMode, setViewMode] = useState<"overview" | "timeline">("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const todayDate = getTodayISO();
  let todaysTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate.split("T")[0] === todayDate,
  );
  let upcomingEvents = events.slice(0, 3);
  let activeHabits = habits.slice(0, 3);
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
  const toggleTaskCompleted = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    await toggleTask(id);
    triggerHaptic();
    if (task?.completed) trackMetric(["tasksCompleted"], -1);
    else trackMetric(["tasksCompleted"], 1);
  };
  const handleHabitUpdate = useCallback(
    async (updated: Habit) => {
      const habit = habits.find((h) => h.id === updated.id);
      await editHabit(updated);
      if (!habit) return;
      try {
        await editHabit(updated);
        let updateMetrics: GlobalMetricKey[] = [];
        if (habit.history.length < updated.history.length) {
          updateMetrics.push("habitsCheckedIn");
        }
        if (
          !updated.pendingStreakResetAfter &&
          updated.streak === updated.goal
        ) {
          updateMetrics.push("habitsGoalsCompleted");
        }
        if (
          (!habit.freezeHistory && updated.freezeHistory) ||
          (habit.freezeHistory &&
            updated.freezeHistory &&
            habit.freezeHistory.length < updated.freezeHistory.length)
        ) {
          updateMetrics.push("habitsFrozen");
        }
        if (updateMetrics.length > 0) {
          trackMetric(updateMetrics, 1);
        }
      } catch (e) {
        showToast("Couldn't save habit. Changes have been undone.");
      }
    },
    [trackMetric, habits],
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
          {todaysTasks.length ? (
            todaysTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
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
            activeHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                onUpdate={handleHabitUpdate}
                onDelete={() => 0}
                onEdit={() => 0}
              />
            ))
          ) : (
            <Text style={{ color: theme.habitBase }}>No Active Habits</Text>
          )}
          <Divider style={styles.divider} />
          <AnalyticsSection />
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
              {selectedDate.toDateString() === new Date().toDateString()
                ? "Today"
                : selectedDate.toDateString()}
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
            tasks={tasks}
            timerLogs={timerLogs}
            habits={habits}
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
      <Portal>
        <ChatScreen visible={aiVisible} onDismiss={() => setAiVisible(false)} />
      </Portal>
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
