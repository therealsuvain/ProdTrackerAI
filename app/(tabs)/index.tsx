
import {  StyleSheet, useColorScheme, ScrollView, View } from 'react-native';
import { useDataTest } from '@/hooks/use-data-test';
import { Text, Divider, FAB, Searchbar,  Button, Portal, Modal } from 'react-native-paper';
import TaskItem from '@/components/ui/task-item';
import EventItem from '@/components/ui/event-item';
import TimerLogItem from '@/components/ui/timer-log-item';
import HabitsTracker from '@/components/ui/habits-tracker';
import {  useState } from 'react';
import { useSearch } from '@/hooks/use-search';
import { AnalyticsSection } from '@/components/ui/analytics-section';
import { SearchResults } from '@/components/ui/search-results';
import { AIVoiceModal } from '@/components/ui/ai-voice-modal';
import { IntentConfirmationModal } from '@/components/ui/intent-confirmation-modal';
import { useIntentProcessor } from '@/hooks/use-intent-processor';
import HabitItem from '@/components/ui/habit-item';
import { Provider } from 'react-native-paper';

export default function HomeScreen() {

  const {tasks, setTasks, events, timerLogs, habits} = useDataTest();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchVisible, setSearchVisible] = useState(false);
  const {query, performSearch, results}= useSearch();
  const [aiVisible, setAiVisible]= useState(false);
  const {intent, processCommand, confirmExecute} = useIntentProcessor();

  let todaysTasks= tasks.filter(t=>t.dueDate && t.dueDate.toDateString() == new Date().toDateString());
  let upcomingEvents= events.slice(0,3);
  let activeHabits= habits.slice(0,3);
  let recentLogs= timerLogs.slice(0,3);


  const toggleTaskCompleted =(id: string)=>{
    setTasks(tasks.map(t=> id ===t.id?{...t, completed: !t.completed}:t));
  }
  return (
    <Provider>
    <ScrollView>
      <Searchbar style={{marginVertical:4}} placeholder='Search Everything' onChangeText={performSearch} value={query}/>
      {results.length>0 && <Button onPress={()=> setSearchVisible(true)}> View Results ({results.length})</Button>}
     <Text style={{color:"#673AB7"}} variant="headlineLarge">Today's Task</Text>
     {todaysTasks.length? 
     todaysTasks.map(task=>(<TaskItem key={task.id} task={task} onToggleComplete={toggleTaskCompleted} />))
     :<Text style={{color:"#673AB7"}} >No task Today</Text>}
      <Divider style={styles.divider}/>

      <Text style={{color:"#F44336"}} variant='headlineLarge'>Upcoming Events</Text>
      {upcomingEvents.length?upcomingEvents.map(event=>(<EventItem key={event.id} event={event}></EventItem>)):<Text style={{color:"#F44336"}} >No Upcoming Events</Text>}
      <Divider style={styles.divider}/>
      
      <Text style={{color:"#05ce9cff"}} variant='headlineLarge'>Recent Timer Logs</Text>
      {recentLogs.length? recentLogs.map(log=>(<TimerLogItem key={log.id} log={log}/>)):<Text style={{color:"#05ce9cff"}}>No Recent Logs</Text>}
      <Divider style={styles.divider}/>
      
      <Text style={{color:"#f1b718ff"}} variant='headlineLarge'>Active Habits</Text>
      {activeHabits.length? activeHabits.map(habit=>(<HabitItem key={habit.id} habit={habit}/>)):<Text style={{color:"#f1b718ff"}} >No Active Habits</Text>}
      <Divider style={styles.divider}/>
      <AnalyticsSection/>
      <Portal>
        <Modal visible={searchVisible} onDismiss={()=>setSearchVisible(false)}>
          <SearchResults results={results} onItemPress={(result) =>{
            setSearchVisible(false);
          }}
          />
        </Modal>
      </Portal>
       
      
      <AIVoiceModal visible={aiVisible} onDismiss={()=>setAiVisible(false)} IntentProcessor = {processCommand}/>
      <IntentConfirmationModal intent={intent} onConfirm={confirmExecute}/>
    </ScrollView>
    <FAB style={{position: 'absolute', bottom:80, right:16 , backgroundColor:"grey"}} color="white" icon='microphone' 
      onPress={()=>setAiVisible(true)}/>
    </Provider>
  );
}

const styles = StyleSheet.create({
  text: { color: '#fff', fontSize: 24 },
  container: { flex: 1, padding: 16 },
  sectionTitle: { marginVertical: 8 },
  divider: { marginVertical: 16 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

