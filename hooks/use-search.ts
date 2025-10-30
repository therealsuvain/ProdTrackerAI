import { useState } from "react";
import { useData } from "./use-data"
import { globalSearch, SearchResult } from "@/utils/search-utils";

export const useSearch =() =>{
    const {tasks,events, habits, timerLogs}= useData();
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