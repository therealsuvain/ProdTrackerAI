import  { AIHandler } from "@/types/ai-handler";
import { createEvent } from "../model-factory-utils";
import { scheduleReminderEvents } from "../../hooks/use-notifications";
import {generateEmbedding} from "@/utils/embedding-engine"

export const AddEventHandler : AIHandler = {
    execute : async (params, context) => {
        const newEvent = await createEvent(params);
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
    if(params.title){
        const embeddingVector = await generateEmbedding(params.title,false);
        params.embedding= embeddingVector;
    }
    const oldEvent = context.events.find((e)=> e.id.slice(0,8) === params.id)
    const updatedEvent = await createEvent({...oldEvent, ...params, id:oldEvent?.id})
    context.setEvents((prev) => 
      prev.map((e) => (e.id.slice(0,8)  === params.id ? updatedEvent : e))
    );
  }
};

export const DeleteEventHandler: AIHandler = {
  execute: async (params, context) => {
    context.setEvents((prev) => prev.filter((e) => e.id.slice(0,8)  !== params.id));
  }
};