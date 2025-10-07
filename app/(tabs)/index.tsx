
import {  StyleSheet, useColorScheme, ScrollView } from 'react-native';
import { useDataTest } from '@/hooks/use-data-test';
import { Text, Divider, Switch } from 'react-native-paper';
import TaskItem from '@/components/ui/task-item';
import EventItem from '@/components/ui/event-item';
import TimerLogItem from '@/components/ui/timer-log-item';
import HabitsTracker from '@/components/ui/habits-tracker';




export default function HomeScreen() {

  const {tasks, setTasks, events, timerLogs, habits} = useDataTest();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const todaysTasks = tasks.filter(t=>t.dueDate && t.dueDate.toDateString() == new Date().toDateString());
  const upcomingEvents = events.slice(0,3);
  const activeHabits = habits.slice(0,3);
  const recentLogs = timerLogs.slice(0,3);

  const toggleTaskCompleted =(id: string)=>{
    setTasks(tasks.map(t=> id ===t.id?{...t, completed: !t.completed}:t));
  }
  return (
    <ScrollView style={{backgroundColor:'white'}}>
     <Text variant="headlineLarge">Today's Task</Text>
     {todaysTasks.length? 
     todaysTasks.map(task=>(<TaskItem key={task.id} task={task} onToggleComplete={toggleTaskCompleted} />))
     :<Text>No task Today</Text>}
      <Divider style={styles.divider}/>

      <Text variant='headlineLarge'>Upcoming Events</Text>
      {upcomingEvents.length?upcomingEvents.map(event=>(<EventItem key={event.id} event={event}></EventItem>)):<Text>No Upcoming Events</Text>}
      <Divider style={styles.divider}/>
      
      <Text variant='headlineLarge'>Recent Timer Logs</Text>
      {recentLogs.length? recentLogs.map(log=>(<TimerLogItem key={log.id} log={log}/>)):<Text>No Recent Logs</Text>}
      <Divider style={styles.divider}/>
      
      <Text variant='headlineLarge'>Active Habits</Text>
      {activeHabits.length? activeHabits.map(habit=>(<HabitsTracker key={habit.id} habit={habit}/>)):<Text>No Active Habits</Text>}
      <Divider style={styles.divider}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  text: { color: '#fff', fontSize: 24 },
  container: { flex: 1, padding: 16 },
  sectionTitle: { marginVertical: 8 },
  divider: { marginVertical: 16 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

