import { Habit } from "@/types/habits";

export const calculateStreak =(habit : Habit): number =>{
    if(!habit.lastCompleted)
        return 0;
    const today = new Date();
    const last = new Date(habit.lastCompleted);
    const diff = Math.floor((today.getTime()-last.getTime())/(24*1000*60*60))
    return diff ===  0 || diff === 1? habit.streak : 0;
}

export const updateStreak = (habit: Habit): Habit =>{
    const today= new Date().toDateString();
    if(habit.lastCompleted?.toDateString() ===  today)
        return habit;
    return {
        ...habit,
        streak: calculateStreak(habit)+1,
        lastCompleted: new Date(),
    }
}