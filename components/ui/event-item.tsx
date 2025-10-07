import { CalendarEvent } from "@/types/calendar";
import { Card, Text } from "react-native-paper";

interface EventItemProps{
    event: CalendarEvent;
}

export default function EventItem({event}: EventItemProps) {
    return(
        <Card style={{marginVertical:8}}>
            <Card.Content>
                <Text variant='titleMedium'>{event.title}</Text>
                <Text>Start:{event.startTime.toLocaleString()}</Text>
                {event.endTime && <Text>End:{event.endTime.toLocaleString()}</Text>}
                {event.description && <Text>{event.description.slice(0,50)}</Text>}
            </Card.Content>
        </Card>
    )

}