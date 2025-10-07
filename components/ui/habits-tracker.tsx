import { Habit } from "@/types/habits";
import { Card, ProgressBar, Text } from "react-native-paper";

interface HabitTrackerProps {
    habit: Habit;
}

export default function HabitsTracker({habit}:HabitTrackerProps){
    const progress = habit.goal? habit.streak/habit.goal : 0;
    return(
        <Card style={{marginVertical:8}}>
            <Card.Content>
                <Text variant='titleMedium'>{habit.name}</Text>
                <Text>Streak:{habit.streak} days</Text>
                <ProgressBar progress={progress} color="blue"/>
            </Card.Content>
        </Card>
    )

}