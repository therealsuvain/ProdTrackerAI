import { TimerLog } from "@/types/timer";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import XButton from "../XButton";
import { useRoute } from '@react-navigation/native';
import { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";

interface TimerLogItemProps{
    log:TimerLog;
    onDelete?: ()=> void;
}

export default function TimerLogItem({log, onDelete}:TimerLogItemProps){

    const {theme}= useContext(ThemeContext)
    const route = useRoute();
    const isNotHome = route.name!=="index" 

    const duration = log.duration? `${log.duration/60} min `: 'Ongoing';
    return (
        <Card style={ [styles.container,{backgroundColor:theme.timerDarkPrimary}]}>
            <Card.Content style={{position:"relative"}}>
                <Text  style={{color:theme.text}} variant="titleMedium">{log.title}</Text>
                <Text style={{color:theme.text}} >Duration: {duration}</Text>
                <Text style={{color:theme.text}} >Started: {log.startTime.toLocaleString()}</Text>
                <View style={{position:"absolute", right:10, top:25}}>
                    { isNotHome && <XButton icon="trash-outline" mode="timer" onPress={onDelete}/>}
                </View>
                
            </Card.Content>
        </Card>

    )
}

const styles = StyleSheet.create({
    container:{marginVertical:8, width:"100%", position:"relative"},

})