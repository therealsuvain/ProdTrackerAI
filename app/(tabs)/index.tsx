import { StyleSheet, ScrollView, View } from "react-native";
import {
  Text,
  Divider,
  FAB,
  Searchbar,
  Button,
  Portal,
  Modal,
  SegmentedButtons,
} from "react-native-paper";
import { Provider } from "react-native-paper";

import TaskItem from "@/components/ui/tasks/task-item";
import EventItem from "@/components/ui/calendar-events/event-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { useContext, useState } from "react";
import { useSearch } from "@/hooks/use-search";
import { AnalyticsSection } from "@/components/ui/analytics-section";
import { SearchResults } from "@/components/ui/search-results";
import HabitItem from "@/components/ui/habits/habit-item";
import UnifiedTimeline from "@/components/ui/home-timeline";
import { useNotifications } from "@/hooks/use-notifications";
import { Habit } from "@/types/habits";
import { ThemeContext } from "@/context/ThemeContext";
import { ChatScreen } from "@/components/ui/chat/chat-screen";
import { getTodayISO } from "@/utils/common-utils";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { useTasks } from "@/hooks/use-tasks";
import { useHabits } from "@/hooks/use-habits";
import { useLogs } from "@/hooks/use-logs";
import { useEvents } from "@/hooks/use-events";

/**
 * TODO 2 : Many files are very large, try and make it more modular. ALL FILES HAVE TO CHECKED FOR POSSIBLE <REFACTORS></REFACTORS>
 * TODO 3 : Account creation, authentication, login
 * TODO 4 : CLOUD DATA SYNC ABILITY with account
 * TODO 5 : Pay wall, barring paid features for free users
 * TODO 6 : Notifications edits via AI chat
 * TODO 7 : Maybe custom notifications options
 * TODO 10 : new Date() is expensive in javascript so have be to memomized everywhere
 * TODO 11 : Input sanitization
 * TODO 12 : Check for Security enhancements and possible securicty concerns for the entire app
 * TODO 14: Timer Screen Flip Animation state issues- FIX'em
 * TODO 17 : Achivements Page color scheme updation
 * TODOY 18 : Achievements Badges generation, maybe pixelated or sprite version of meme refered by the achievment phrase
 * TODO 19 : Greatly enhancing analytics
 * TODO 20 : More metrics tracking need to added, not all need to for achievements, instead for analytics
 * TODO 21 : Codebase updation for iOS
 * TODO 22 : Testing on bigger/smaller screens. Test on different devices
 * TODO 23 : home page search enhancment or removal. R&D
 * TODO 25 : Habit successful checkin feedback
 * TODO 27 : R&D better Calendar screen, refer google calendar maybe.
 * TODOX 31 : If tags and categoires are added, embeddings for them?, atleast searchable via physical search, AI handlers also would need to be updated
 * TODOX 32 : Common UI for tags/tag-list, shape like a literal tag
 * TODOX 33 : Light mode color fixes
 * TODO 34 : Maybe keep darkMode as default irrespective of system settings
 * TODO 35 : Item Label(Home-screen Today's tasks , events, habits etc) animations, like ads
 * TODO 36 : Mayeb add more animations for the app. R&D
 * TODO 37 : More settings options
 * TODO 38 : Few more achievements
 * TODO 60 : R&D how mantain analytics data for deleted items
 * TODO 61 : Allow title change in chat action chips
 * TODO 65 : Check for steps required to adapte date/time fields to different Timezones and day light saving time changes
 * TODO 102: Ordering of tasks , habits, logs is on consistent on their pages logs should in reverse order based on creating Date
 *
 */
function HomeScreenInner() {
  const { theme } = useContext(ThemeContext);
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

  const toggleTaskCompleted = async (id: string) => {
    await toggleTask(id);
  };
  const handleHabitUpdate = async (updated: Habit) => {
    await editHabit(updated);
  };

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

          <Text style={{ color: theme.taskBase }} variant="headlineLarge">
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

          <Text style={{ color: theme.eventBase }} variant="headlineLarge">
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

          <Text style={{ color: theme.timerBase }} variant="headlineLarge">
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

          <Text style={{ color: theme.habitBase }} variant="headlineLarge">
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
              textColor={theme.blueLightPrimary}
              onPress={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
            >
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
              textColor={theme.blueLightPrimary}
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
  sectionTitle: { marginVertical: 8 },
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
