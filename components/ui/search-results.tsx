import { SearchResult } from "@/utils/search-utils";
import { FlatList, TouchableOpacity, View, Text } from "react-native";
import TaskItem from "./tasks/task-item";
import EventItem from "./calendar-events/event-item";
import TimerLogItem from "./timer-logs/timer-log-item";
import HabitItem from "./habits/habit-item";

interface SearchResultsProps {
  results: SearchResult[];
  onItemPress: (result: SearchResult) => void;
}

export function SearchResults({ results, onItemPress }: SearchResultsProps) {
  return (
    <FlatList
      data={results}
      keyExtractor={(item, index) => `${item.type}-${index}`}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onItemPress(item)}>
          {item.type === "task" && (
            <TaskItem id={item.item.id as any} onToggleComplete={() => {}} />
          )}
          {item.type === "event" && <EventItem id={item.item as any} />}
          {item.type === "habit" && (
            <HabitItem
              id={item.item as any}
              onCheckin={async (id) => undefined}
              onDelete={() => 0}
              onEdit={() => 0}
            />
          )}
          {item.type === "log" && (
            <TimerLogItem
              logId={item.item as any}
              onDelete={() => {}}
              onEdit={() => {}}
            />
          )}
          <Text> Type: {item.type}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text>No results Found</Text>}
    />
  );
}
