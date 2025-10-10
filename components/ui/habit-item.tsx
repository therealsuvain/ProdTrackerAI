import { Card, Text, Button, ProgressBar } from "react-native-paper";
import { Habit } from "@/types/habits";
import { updateStreak} from "@/utils/habit-utils"

interface HabitItemProps {
    habit : Habit;
    onUpdate : (updated : Habit) => void;
    onDelete : (id: string) => void;
}

export default function HabitItem({habit, onUpdate, onDelete}:HabitItemProps){
    const progress = habit.goal? habit.streak / habit.goal : 0;

    const handleCheckIn = () =>onUpdate(updateStreak(habit));

    return (
        <Card style= {{marginVertical: 8}}>
            <Card.Content>
                <Text variant='titleMedium'>{habit.name}</Text>
                <Text>Streak: {habit.streak} / Goal: {habit.goal || 'OnGoing'}</Text>
                <ProgressBar progress={progress} color="green"/>
                <Button onPress={handleCheckIn}>Check in</Button>
                <Button onPress={()=>{onDelete(habit.id)}} color ="red">Delete</Button>
            </Card.Content>
        </Card>
    )
}