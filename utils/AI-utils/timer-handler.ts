import  { AIHandler } from "@/types/ai-handler";

export const StartTimerHandler: AIHandler = {
  execute: async (params, context) => {
    context.setTitle(params.title || "Unnamed Timer");
    context.start();
    context.navigation.navigate("timer-screen");
    
    console.log(`AI Action: Started timer for "${params.title}"`);
  }
};

export const StopTimerHandler: AIHandler = {
  execute: async (params, context) => {
    context.stop();
    context.navigation.navigate("timer-screen");
    
    console.log(`AI Action: Stopped timer`);
  }
};