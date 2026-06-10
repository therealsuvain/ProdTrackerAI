// import React, {
//   createContext,
//   useContext,
//   useState,
//   useRef,
//   useEffect,
//   ReactNode,
// } from 'react';
// import { randomUUID } from 'expo-crypto';
// import { TimerLog } from '@/types/timer';
// import { useData } from '@/hooks/context-hooks/use-data';

// interface TimerContextType {
//   time: number;
//   isRunning: boolean;
//   title: string;
//   start: () => void;
//   pause: () => void;
//   stop: () => void;
//   reset: () => void;
//   setTitle: (title: string) => void;
// }
// export const TimerContext = createContext<TimerContextType | undefined>(
//   undefined
// );

// export default function TimerProvider({ children }: { children: ReactNode }){
// const [time, setTime]= useState(0);
//     const [isRunning, setIsRunning]= useState(false);
//     const [title, setTitle] = useState('');
//     const intervalRef = useRef<number|null>(null);
//     const startTimeRef = useRef<Date | null>(null);
//     const {timerLogs,setTimerLogs}= useData()

//     useEffect(()=>{
//         if(isRunning){
//             intervalRef.current = setInterval(()=> setTime(prev=>prev+1),1000);
//         } else if(intervalRef.current){
//             clearInterval(intervalRef.current);
//         }
//         return ()=> {
//             if(intervalRef.current)
//                 clearInterval(intervalRef.current);
//         }
//     },[isRunning])

//     const start = () => {
//         setIsRunning(true);
//         startTimeRef.current = new Date();
//     };

//     const pause = () => setIsRunning(false);

//     const stop = () => {
//         setIsRunning(false);
//         if(startTimeRef.current && time > 0){
//             const log : TimerLog = {
//                 id: randomUUID(),
//                 title,
//                 startTime: startTimeRef.current,
//                 endTime: new Date(),
//                 duration : time,
//             };
//             setTimerLogs([...timerLogs, log]);
//         }
//         reset();
//     };

//     const reset = () => {
//         setTime(0);
//         setTitle('');
//         startTimeRef.current=null;
//     }
//       const value: TimerContextType = {
//     time,
//     isRunning,
//     title,
//     start,
//     pause,
//     stop,
//     reset,
//     setTitle,
//   };

//   return (
//     <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
//   );

// }
