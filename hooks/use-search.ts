import { useState } from "react";
import { useData } from "./context-hooks/use-data"
import { globalSearch, SearchResult } from "@/utils/search-utils";
import { useEvents } from "./context-hooks/use-events";
import { useLogs } from "./context-hooks/use-logs";
import { useHabits } from "./context-hooks/use-habits";
import { useShallow } from "zustand/shallow";
import { useTaskStore } from "@/stores/use-task-store";

export const useSearch = () => {
    const tasks = useTaskStore(
    useShallow((state) => Object.values(state.tasksById)),
  );
    const { events } = useEvents();
    const { timerLogs } = useLogs();
    const { habits } = useHabits();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);

    const performSearch = (newQuery: string) => {
        setQuery(newQuery);
        if (newQuery.trim() === '') {
            setResults([]);
        } else {
            setResults(globalSearch(newQuery, tasks, events, habits, timerLogs));
        }
    };

    return { query, results, performSearch };
}