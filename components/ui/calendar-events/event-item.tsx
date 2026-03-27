import { CalendarEvent } from "@/types/calendar";
import { Card, Text } from "react-native-paper";
import {XButton} from "../x-button";
import { View, StyleSheet } from "react-native";
import { useRoute } from '@react-navigation/native';
import { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";

interface EventItemProps{
    event: CalendarEvent;
    onEdit?: ()=>void ;
    onDelete? : ()=>void;
}

export default function EventItem({event, onEdit, onDelete}: EventItemProps) {
    const {theme} = useContext(ThemeContext)
    const route = useRoute();
    const isNotHome = route.name!=="index" 
    return(
        <Card style={[styles.card,{backgroundColor:theme.eventDarkPrimary}, !isNotHome && {borderRadius:0}]}>
            <Card.Content style={styles.content}>
                <View>
                <Text style={{color:theme.whiteBase}}variant='titleMedium'>{event.title}</Text>
                { !isNotHome && <Text style={{color:theme.whiteBase}}>Start:{new Date(event.startTime).toLocaleTimeString()}</Text>}
                { !isNotHome && <Text style={{color:theme.whiteBase}}>End:{new Date(event.endTime).toLocaleTimeString()}</Text>}
                </View>
                <View style={styles.buttonContainer}>
                { isNotHome && <XButton icon="pencil-outline" mode="calendar" onPress={onEdit}/>}
                { isNotHome && <XButton icon="trash-outline" mode="calendar" onPress={onDelete}/>}
                </View>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card:{ marginVertical:8, position:"relative"},
    content:{flexDirection: 'row', alignItems: 'center', justifyContent:'space-between'},
    buttonContainer:{flexDirection:'row', marginLeft:8},
})