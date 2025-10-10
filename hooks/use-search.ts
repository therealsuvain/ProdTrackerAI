import { useState } from "react";
import { useDataTest } from "./use-data-test"
import { globalSearch, SearchResult } from "@/utils/search-utils";

export const useSearch =() =>{
    const {tasks,events, habits, timerLogs}= useDataTest();
    const [query,setQuery] = useState('');
    const [results, setResults]= useState<SearchResult[]>([]);

    const performSearch = (newQuery : string) => {
        setQuery(newQuery);
        if (newQuery.trim() === ''){
            setResults([]);
        } else {
            setResults(globalSearch(newQuery, tasks, events, habits, timerLogs));
        }
    };

    return {query , results, performSearch};
}