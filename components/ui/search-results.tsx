import { SearchResult } from "@/utils/search-utils";
import { FlatList, TouchableOpacity, View, Text } from "react-native";
import TaskItem from "./task-item";
import EventItem from "./event-item";
import TimerLogItem from "./timer-log-item";
import HabitItem from "./habit-item";

interface SearchResultsProps {
    results: SearchResult[];
    onItemPress : (result : SearchResult) => void
}

export function SearchResults({ results, onItemPress }: SearchResultsProps) {
    return (
       <FlatList
       data={results}
       keyExtractor={(item, index)=> `${item.type}-${index}`}
       renderItem = {({item})=>(
        <TouchableOpacity onPress={()=>onItemPress(item)}>
            {item.type === 'task' && <TaskItem task={item.item as any} onToggleComplete={()=>{}}/>}
            {item.type === 'event' && <EventItem event={item.item as any}/>}
            {item.type === 'habit' && <HabitItem habit={item.item as any}/>}
            {item.type === 'log' && <TimerLogItem log={item.item as any}/>}
            <Text> Type: {item.type}</Text>
        </TouchableOpacity>
       )}
       ListEmptyComponent={<Text>No results Found</Text>}
       />
    );
}
