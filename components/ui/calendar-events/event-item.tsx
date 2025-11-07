import { CalendarEvent } from "@/types/calendar";
import { Card, Text } from "react-native-paper";
import XButton from "../XButton";
import { View, StyleSheet } from "react-native";
import { useRoute } from '@react-navigation/native';

interface EventItemProps{
    event: CalendarEvent;
    onEdit?: ()=>void ;
    onDelete? : ()=>void;
}

export default function EventItem({event, onEdit, onDelete}: EventItemProps) {
    const route = useRoute();
    const isNotHome = route.name!=="index" 
    return(
        <Card style={styles.card}>
            <Card.Content style={styles.content}>
                <View>
                <Text variant='titleMedium'>{event.title}</Text>
                { !isNotHome && <Text>Start:{event.startTime.toLocaleTimeString()}</Text>}
                { !isNotHome && <Text>End:{event.endTime.toLocaleTimeString()}</Text>}
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
    card:{ marginVertical:8, position:"relative" , backgroundColor:"#3b302fff"},
    content:{flexDirection: 'row', alignItems: 'center', justifyContent:'space-between'},
    buttonContainer:{flexDirection:'row', marginLeft:8},
    text:{fontSize:16, color:'#fff'},
})