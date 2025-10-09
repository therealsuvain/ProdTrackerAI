import { CalendarEvent } from "@/types/calendar";
import { FlatList, View, StyleSheet, Text } from "react-native";
import {Button } from 'react-native-paper'
import EventItem from "./event-item";

interface DayViewProps{
    events : CalendarEvent[];
    onEventSelect : (event:CalendarEvent)=> void;
    onDelete : (id:string)=>void;
}

export default function DayView({events, onEventSelect, onDelete}: DayViewProps){
    if(events.length===0){
        return <Text style={styles.noEvents}> No events today</Text>
    }
    return (
        <FlatList
        data={events}
        keyExtractor={item=>item.id}
        renderItem={({item})=>(
            <View>
                <EventItem event={item}/>
                <Button onPress={()=>onEventSelect(item)}>Edit</Button>
                <Button onPress={()=>onDelete(item.id)} buttonColor="red">Delete</Button>
            </View>
        )}
        />
    )
}

const styles = StyleSheet.create({
  noEvents: { textAlign: 'center', marginTop: 20 },
});