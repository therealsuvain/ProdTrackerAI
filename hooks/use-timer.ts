import { useState, useRef, useEffect } from "react";
import { TimerLog } from "@/types/timer";

export const useTimer =(addLog: (log : TimerLog) => void) => {
    const [time, setTime]= useState(0);
    const [isRunning, setIsRunning]= useState(false);
    const [activity, setActivity] = useState('');
    const intervalRef = useRef<number|null>(null);
    const startTimeRef = useRef<Date | null>(null);

    useEffect(()=>{
        if(isRunning){
            intervalRef.current = setInterval(()=> setTime(prev=>prev+1),1000);
        } else if(intervalRef.current){
            clearInterval(intervalRef.current);
        }
        return ()=> {
            if(intervalRef.current)
                clearInterval(intervalRef.current);
        }
    },[isRunning])

    const start = () => {
        setIsRunning(true);
        startTimeRef.current = new Date();
    };

    const pause = () => setIsRunning(false);

    const stop = () => {
        setIsRunning(false);
        if(startTimeRef.current && time > 0){
            const log : TimerLog = {
                id: Date.now().toString(),
                activity,
                startTime: startTimeRef.current,
                endTime: new Date(),
                duration : time,
            };
            addLog(log);
        }
        reset();
    };

    const reset = () => {
        setTime(0);
        setActivity('');
        startTimeRef.current=null;
    }

    return {time, isRunning, activity, setActivity, start, pause, stop , reset};

}