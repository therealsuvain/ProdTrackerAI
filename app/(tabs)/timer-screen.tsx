import TimerDisplay from "@/components/ui/timer-logs/time-display";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import XButton from "@/components/ui/XButton";
import { useData } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { TimerLog } from "@/types/timer";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Alert, StyleSheet,  Button, FlatList } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TextInput } from "react-native-paper";
import { Provider } from "react-native-paper";

export default function TimerScreen() {
  const {timerLogs,setTimerLogs} = useData();
  //const addLog = (log : TimerLog) => setTimerLogs([...timerLogs, log]);
  const { time, isRunning, title, setTitle, start, pause, stop, reset }= useTimer();

  const handleDelete = (id:string) => {
    Alert.alert('Delete Log', 'Are you sure?', [
      {text: 'Cancel'},
      {text: 'Delete', onPress: ()=> setTimerLogs(timerLogs.filter(l => l.id !== id))}
    ])
  }

  return (
    <Provider>
    <GestureHandlerRootView>
    <View style={styles.container}>
      <TextInput
        placeholder="Activity name"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        mode="outlined"
        activeOutlineColor="#05ce9cff"
      />
      <TimerDisplay time={time}/>
      <View style={styles.buttons}>
        {!isRunning?<XButton icon ="play" mode="timer" size="big" onPress={start} />

        :(<> 
        <XButton icon ="pause" mode='timer' size="big"  onPress={pause}/>
        <XButton icon ="stop" mode="timer" size="big"  onPress={stop}/>
        <XButton icon ="refresh" mode="timer" size="big" onPress={reset}/>
        </>)}
       
      </View>
      <Text style={{color:'white'}}>Recent Logs</Text>
        <FlatList
        data= {timerLogs.slice(-10)}
        keyExtractor={item=>item.id}
        style={{width:"95%"}}
        showsVerticalScrollIndicator={false}
        renderItem={({item})=>(
            <TimerLogItem log={item} onDelete={()=> handleDelete(item.id)}/>
        )}
       />
      </View>
      </GestureHandlerRootView>
      </Provider>
  );
}

const styles = StyleSheet.create({
  container: {  flex: 1,padding: 16, alignItems: 'center' },
  input: { width: '100%', borderBottomWidth: 1, marginBottom: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginVertical: 16 },
});