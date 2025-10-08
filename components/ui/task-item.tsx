import { Task } from "@/types/task";
import { Badge, Button, Card, Checkbox } from "react-native-paper";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface TaskItemProps{
    task: Task;
    onToggleComplete: (id: string) => void;
}

export default function TaskItem({ task, onToggleComplete }: TaskItemProps) {
    const priorityColor = {
        low: 'green',
        medium:'orange',
        high:'red',
    }[task.priority];

    // Edit and Delete buttons are bad, need changes
    return (
        <Card style={styles.card}>
            <Card.Content style={styles.content}>
                <Checkbox
                status={task.completed? "checked":"unchecked"}
                onPress={()=>onToggleComplete(task.id)}
                />
                <View style={styles.textContainer}>
                    <Text style={task.completed? styles.completedText : styles.text}>
                        {task.title}
                    </Text>
                    {task.dueDate && <Text>Due : {task.dueDate.toDateString()}</Text>}
                </View>
                
                <Button style={styles.button}  onPress={() => {}}>
                    <Ionicons name="pencil" size={16} color="white" />
                </Button>
                <Button style={styles.button} onPress={() => {}}>
                    <Ionicons name="trash" size={16} color="white" />
                </Button>
                <Badge style={{backgroundColor: priorityColor}}>
                    {task.priority}
                </Badge>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card:{ marginVertical:8},
    content:{flexDirection: 'row', alignItems: 'center'},
    textContainer:{flex:1, marginLeft:8},
    text:{fontSize:16, color:'#fff'},
    completedText:{fontSize:16, textDecorationLine:'line-through', color:'gray'},
    button:{ backgroundColor:'blue', height:20, width:20, borderRadius:10, marginHorizontal:2}
})