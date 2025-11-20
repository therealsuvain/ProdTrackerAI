import { useState, useRef, useEffect, useContext } from "react";
import { TimerLog } from "@/types/timer";
import { randomUUID } from "expo-crypto";
import { TimerContext } from "@/context/TimerContextC";

export const useTimer =(/*addLog: (log : TimerLog) => void*/) => {
    // const [time, setTime]= useState(0);
    // const [isRunning, setIsRunning]= useState(false);
    // const [title, setTitle] = useState('');
    // const intervalRef = useRef<number|null>(null);
    // const startTimeRef = useRef<Date | null>(null);

    // useEffect(()=>{
    //     if(isRunning){
    //         intervalRef.current = setInterval(()=> setTime(prev=>prev+1),1000);
    //     } else if(intervalRef.current){
    //         clearInterval(intervalRef.current);
    //     }
    //     return ()=> {
    //         if(intervalRef.current)
    //             clearInterval(intervalRef.current);
    //     }
    // },[isRunning])

    // const start = () => {
    //     setIsRunning(true);
    //     startTimeRef.current = new Date();
    // };

    // const pause = () => setIsRunning(false);

    // const stop = () => {
    //     setIsRunning(false);
    //     if(startTimeRef.current && time > 0){
    //         const log : TimerLog = {
    //             id: randomUUID(),
    //             title,
    //             startTime: startTimeRef.current,
    //             endTime: new Date(),
    //             duration : time,
    //         };
    //         addLog(log);
    //     }
    //     reset();
    // };

    // const reset = () => {
    //     setTime(0);
    //     setTitle('');
    //     startTimeRef.current=null;
    // }
    
    // return {time, isRunning, title, setTitle, start, pause, stop , reset};
    const timerContext = useContext(TimerContext)
    if (!timerContext) {
        throw new Error("useTimer must be used within a TimerProvider");
    }
    return timerContext;

}