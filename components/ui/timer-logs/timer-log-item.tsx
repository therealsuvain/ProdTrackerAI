import { TimerLog } from "@/types/timer";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import XButton from "../XButton";
import { useRoute } from '@react-navigation/native';

interface TimerLogItemProps{
    log:TimerLog;
    onDelete?: ()=> void;
}

export default function TimerLogItem({log, onDelete}:TimerLogItemProps){

    const route = useRoute();
    const isNotHome = route.name!=="index" 

    const duration = log.duration? `${log.duration/60} min `: 'Ongoing';
    return (
        <Card style={{marginVertical:8, width:"100%", position:"relative", backgroundColor:"#2e3b38ff"}}>
            <Card.Content style={{position:"relative"}}>
                <Text  style={styles.text} variant="titleMedium">{log.title}</Text>
                <Text style={styles.text} >Duration: {duration}</Text>
                <Text style={styles.text} >Started: {log.startTime.toLocaleString()}</Text>
                <View style={{position:"absolute", right:10, top:25}}>
                    { isNotHome && <XButton icon="trash-outline" mode="timer" onPress={onDelete}/>}
                </View>
                
            </Card.Content>
        </Card>

    )
}

const styles = StyleSheet.create({

    text:{color:"#ffffffff"}
})