import {
  StyleSheet,
  useColorScheme,
  ScrollView,
  View,
  Appearance,
} from "react-native";
import { useEffect }  from "react";
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

import { useData } from "@/hooks/use-data";
import TaskItem from "@/components/ui/tasks/task-item";
import EventItem from "@/components/ui/calendar-events/event-item";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { useContext, useState } from "react";
import { useSearch } from "@/hooks/use-search";
import { AnalyticsSection } from "@/components/ui/analytics-section";
import { SearchResults } from "@/components/ui/search-results";
import HabitItem from "@/components/ui/habits/habit-item";
import { Provider } from "react-native-paper";
import LoadingIndicator from "@/components/loading-indicator";
import UnifiedTimeline from "@/components/ui/home-timeline";
import { useNotifications } from "@/hooks/use-notifications";
import { Habit } from "@/types/habits";
import { ThemeContext } from "@/context/ThemeContext";
import { ChatScreen } from "@/components/ui/chat/chat-screen";

export default function HomeScreen() {
  const { theme } = useContext(ThemeContext);
  const { tasks, setTasks, events, setEvents, timerLogs, habits, setHabits } = useData();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchVisible, setSearchVisible] = useState(false);
  const { query, performSearch, results } = useSearch();
  const [aiVisible, setAiVisible] = useState(false);
  useNotifications();
  const [viewMode, setViewMode] = useState<"overview" | "timeline">("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());

  let todaysTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate.toDateString() == new Date().toDateString(),
  );
  let upcomingEvents = events.slice(0, 3);
  let activeHabits = habits.slice(0, 3);
  let recentLogs = timerLogs.slice(0, 3);

  const toggleTaskCompleted = (id: string) => {
    setTasks(
      tasks.map((t) => (id === t.id ? { ...t, completed: !t.completed } : t)),
    );
  };
  const handleHabitUpdate = (updated: Habit) => {
    setHabits(habits.map((h) => (h.id === updated.id ? updated : h)));
  };

  // useEffect(()=>{
  //   migrateToSemanticSearch({tasks, setTasks, habits, setHabits, events, setEvents})
  // },[])
  return (
    <Provider>
      {/* {(isLoading || isProcessing) && <LoadingIndicator />} */}
      <View style={{ backgroundColor: theme.background}}>
      <SegmentedButtons
        value={viewMode}
        onValueChange={(value) => setViewMode(value as "overview" | "timeline")}
        buttons={[
          {
            value: "overview",
            label: "Overview",
            icon: "view-dashboard",
            checkedColor: theme.blueLightPrimary,
            style: {
              backgroundColor:
                viewMode === "overview" ? theme.blueDarkPrimary : "transparent",
            },
          },
          {
            value: "timeline",
            label: "Today's Timeline",
            icon: "timeline",
            checkedColor: theme.blueLightPrimary,
            style: {
              backgroundColor:
                viewMode === "timeline" ? theme.blueDarkPrimary : "transparent",
            },
          },
        ]}
        style={[styles.viewSwitcher, { backgroundColor: theme.background }]}
      />
      </View>
      {viewMode === "overview" ? (
        <ScrollView style={{ backgroundColor: theme.background }}>
          <Searchbar
            style={{ marginVertical: 4, backgroundColor: theme.taskBaseTransToo }}
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
            recentLogs.map((log) => <TimerLogItem key={log.id} log={log} />)
          ) : (
            <Text style={{ color: theme.timerBase }}>No Recent Logs</Text>
          )}
          <Divider style={styles.divider} />

          <Text style={{ color: theme.habitBase }} variant="headlineLarge">
            Active Habits
          </Text>
          {activeHabits.length ? (
            activeHabits.map((habit) => (
              <HabitItem key={habit.id} habit={habit} />
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
        <View style={[styles.timelineContainer, { backgroundColor: theme.background }]}>
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
