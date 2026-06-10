import { useState } from "react";
import { useData } from "./context-hooks/use-data"
import { globalSearch, SearchResult } from "@/utils/search-utils";
import { useTasks } from "./context-hooks/use-tasks";
import { useEvents } from "./context-hooks/use-events";
import { useLogs } from "./context-hooks/use-logs";
import { useHabits } from "./context-hooks/use-habits";

export const useSearch = () => {
    const { tasks } = useTasks();
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