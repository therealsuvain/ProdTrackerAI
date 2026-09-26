import { useState } from "react";
import { useData } from "./context-hooks/use-data"
import { globalSearch, SearchResult } from "@/utils/search-utils";
import { useShallow } from "zustand/shallow";
import { useTaskStore } from "@/stores/use-task-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { useEventStore } from "@/stores/use-event-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";

export const useSearch = () => {
    const tasks = useTaskStore(
        useShallow((state) => Object.values(state.tasksById)),
    );
    const events = useEventStore(
        useShallow((state) => Object.values(state.eventsById)),
    );
    const habits = useHabitStore(
        useShallow((state) => Object.values(state.habitsById)),
    );
    const timerLogs = useTimerLogStore(
        useShallow((state) => Object.values(state.logsById)),
    )
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