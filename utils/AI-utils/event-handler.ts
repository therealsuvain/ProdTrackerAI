import  { AIHandler } from "@/types/ai-handler";
import { createEvent } from "../model-factory-utils";
import { scheduleReminderEvents } from "../../hooks/use-notifications";

export const AddEventHandler : AIHandler = {
    execute : async (params, context) => {
        const newEvent = createEvent(params);
        if(newEvent.reminder){
            try {
                newEvent.notificationIds = await scheduleReminderEvents(newEvent);
            } catch (error) {
                console.warn("Failed to schedule event notifications:", error);
            }
        }

        context.setEvents((prev) => [...prev, newEvent]);
        console.log(`AI Action: Added event "${newEvent.title}"`);
    }

}

export const EditEventHandler: AIHandler = {
  execute: async (params, context) => {
    context.setEvents((prev) => 
      prev.map((e) => (e.id.slice(0,8)  === params.id ? { ...e, ...params } : e))
    );
  }
};

export const DeleteEventHandler: AIHandler = {
  execute: async (params, context) => {
    context.setEvents((prev) => prev.filter((e) => e.id.slice(0,8)  !== params.id));
  }
};