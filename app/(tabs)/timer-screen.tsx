import TimerDisplay from "@/components/ui/time-display";
import TimerLogItem from "@/components/ui/timer-log-item";
import { useDataTest } from "@/hooks/use-data-test";
import { useTimer } from "@/hooks/use-timer";
import { TimerLog } from "@/types/timer";
import { View, Text, Alert, StyleSheet, TextInput, Button, FlatList } from "react-native";

export default function TimerScreen() {
  const {timerLogs,setTimerLogs} = useDataTest();
  const addLog = (log : TimerLog) => setTimerLogs([...timerLogs, log]);
  const { time, isRunning, activity, setActivity, start, pause, stop, reset }= useTimer(addLog);

  const handleDelete = (id:string) => {
    Alert.alert('Delete Log', 'Are you sure?', [
      {text: 'Cancel'},
      {text: 'Delete', onPress: ()=> setTimerLogs(timerLogs.filter(l => l.id !== id))}
    ])
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Activity name"
        value={activity}
        onChangeText={setActivity}
        style={styles.input}
      />
      <TimerDisplay time={time}/>
      <View style={styles.buttons}>
        {!isRunning?<Button title ="Start" onPress={start}/>:<Button title ="Stop" onPress={stop}/>}
        <Button title="Stop & Log" onPress={stop} disabled={!isRunning && time === 0}/>
        <Button title="Reset" onPress={reset}/>
        <Text>Recent Logs</Text>
      </View>
        <FlatList
        data= {timerLogs.slice(-10)}
        keyExtractor={item=>item.id}
        renderItem={({item})=>(
          <View>
            <TimerLogItem log={item}/>
            <Button title="Delete" onPress={()=> handleDelete(item.id)} color="red"/>
          </View>
        )}
       />
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: 'center' },
  input: { width: '100%', borderBottomWidth: 1, marginBottom: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 16 },
});