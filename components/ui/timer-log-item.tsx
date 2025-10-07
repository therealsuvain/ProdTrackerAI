import { TimerLog } from "@/types/timer";
import { Card, Text } from "react-native-paper";

interface TimerLogItemProps{
    log:TimerLog;
}

export default function TimerLogItem({log}:TimerLogItemProps){

    const duration = log.duration? `${log.duration/60} min `: 'Ongoing';
    return (
        <Card style={{marginVertical:8}}>
            <Card.Content>
                <Text variant="titleMedium">{log.activity}</Text>
                <Text>Duration: {duration}</Text>
                <Text>Started: {log.startTime.toLocaleString()}</Text>
            </Card.Content>
        </Card>

    )
}