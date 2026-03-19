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

export const QueryEventsHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { timeRange = "today", timeOfDay = "all", specificEventId } = args;
    const now = new Date();

    // DEEP DIVE: If AI asks about a specific event (e.g., "How many yoga classes left?")
    if (specificEventId) {
      const targetEvent = context.events.find((e: any) => e.id.slice(0,8) === specificEventId);
      if (!targetEvent) return { error: "Event not found" };

      // Calculate Remaining Instances natively
      let instancesLeft = 0;
      const end = new Date(targetEvent.endDate);
      
      if (end >= now) {
        if (targetEvent.recurrence === 'none') instancesLeft = 1;
        if (targetEvent.recurrence === 'daily') {
          instancesLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24));
        }
        if (targetEvent.recurrence === 'weekly') {
          instancesLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24 * 7));
        }
        
        // Subtract future deleted occurrences
        const futureDeleted = (targetEvent.deletedOccurrences || []).filter((d: string) => new Date(d) >= now).length;
        instancesLeft = Math.max(0, instancesLeft - futureDeleted);
      }

      return {
        id: targetEvent.id,
        title: targetEvent.title,
        recurrence: targetEvent.recurrence,
        instancesRemaining: instancesLeft,
        deletedOccurrences: targetEvent.deletedOccurrences || [],
        starts: targetEvent.startDate,
        ends: targetEvent.endDate
      };
    }

    // GENERAL QUERY (Time Ranges and Time of Day)
    let filtered = [...(context.events || [])];
    const startOfToday = new Date(now.setHours(0,0,0,0));

    // Filter by Time Of Day (Ignoring date part, just looking at hours)
    if (timeOfDay !== "all") {
      filtered = filtered.filter(e => {
        const hours = new Date(e.startTime).getHours();
        if (timeOfDay === "morning") return hours >= 5 && hours < 12;
        if (timeOfDay === "afternoon") return hours >= 12 && hours < 17;
        if (timeOfDay === "evening") return hours >= 17 && hours <= 23;
        return true;
      });
    }

    // Filter TimeRange (Simplified for brevity, uses startOfToday boundaries)
    // Note: To handle recurring events properly here, you'd check if today falls 
    // between startDate and endDate AND matches the recurrence pattern.
    // For this list, we check the base startDate or active recurrences.
    filtered = filtered.filter(e => {
       const eventStart = new Date(e.startDate);
       if (timeRange === "today") return eventStart >= startOfToday && eventStart < new Date(startOfToday.getTime() + 86400000);
       // ... add logic for tomorrow/yesterday/week matching your previous task handler boundaries
       return true; 
    });

    return {
      results: filtered.map(e => ({
        id: e.id.slice(0,8),
        title: e.title,
        time: e.startTime, // AI can read the time
        recurrence: e.recurrence
      }))
    };
  }
};