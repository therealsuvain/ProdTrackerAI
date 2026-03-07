import  { AIHandler } from "@/types/ai-handler";
import { createHabit } from "../model-factory-utils";
import { scheduleReminderHabits } from "../../hooks/use-notifications";
import {checkInHabit} from "../habit-utils"

export const AddHabitHandler : AIHandler = {
    execute : async (params, context) => {
        const newHabit = await createHabit (params);
        if(newHabit.reminder){
            try {
                newHabit.notificationId = await scheduleReminderHabits(newHabit);
            } catch (error) {
                console.warn("Failed to schedule habit notifications:", error);
            }
        }

        context.setHabits((prev) => [...prev, newHabit]);
        console.log(`AI Action: Added Habit "${newHabit.title}"`);
    }

}

export const DeleteHabitHandler: AIHandler = {
  execute: async (params, context) => {
    context.setHabits((prev) => prev.filter((h) => h.id.slice(0,8)  !== params.id));
  }
};

export const CheckInHabitHandler: AIHandler = {
  execute: async (params, context) => {
    context.setHabits((prev) => 
      prev.map((h) => (h.id.slice(0,8)  === params.id ?  checkInHabit(h): h))
    );
  }
};