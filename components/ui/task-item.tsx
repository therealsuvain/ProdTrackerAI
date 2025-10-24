import { Task } from "@/types/task";
import { Badge, Card, Checkbox } from "react-native-paper";
import { StyleSheet, View, Text, Button } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import XButton from "./XButton";

interface TaskItemProps{
    task: Task;
    onToggleComplete: (id: string) => void;
    onEdit? : () => void;
    onDelete? : () => void
    
}

export default function TaskItem({ task, onToggleComplete, onEdit, onDelete }: TaskItemProps) {
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
                <XButton icon="pencil-outline" onPress={onEdit}/>
                <XButton icon="trash-outline" onPress={onDelete}/>
                <Badge size={7.5} style={[styles.badge, {backgroundColor: priorityColor}]} />

            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card:{ marginVertical:8, position:"relative"},
    content:{flexDirection: 'row', alignItems: 'center', justifyContent:'center'},
    textContainer:{flex:1, marginLeft:8},
    text:{fontSize:16, color:'#fff'},
    completedText:{fontSize:16, textDecorationLine:'line-through', color:'gray'},
    button:{ backgroundColor:'blue', height:20, width:20, borderRadius:10, marginHorizontal:2},
    badge:{ position:"absolute", top:0, right:0, marginHorizontal:2.5}
})