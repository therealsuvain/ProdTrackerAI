import { CalendarEvent } from '@/types/calendar';
import { AIHandler } from '@/types/ai-handler';
import { AIActionMemory } from './ai-action-undo-handlers';
import { DailyCapacity } from '@/types/agent-state';
import { exceuteTriageOverdueNode } from "../agentic-DAG-nodes/handler-specific-nodes/node-t1-triage-overdue";

const WORKING_DAY_START_MINUTES = 9 * 60;  // 9:00 AM
const WORKING_DAY_END_MINUTES = 21 * 60;   // 9:00 PM
const TOTAL_WORKING_MINUTES = WORKING_DAY_END_MINUTES - WORKING_DAY_START_MINUTES;

/**
 * Converts a HH:MM string to total minutes since midnight
 */
const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
};

/**
 * SOTA: Interval Merging Algorithm to extract true free capacity
 */
export const calculateDailyCapacity = (
    events: CalendarEvent[],
    targetDates: string[] // Array of 'YYYY-MM-DD'
): Record<string, DailyCapacity> => {
    const capacityMap: Record<string, DailyCapacity> = {};

    for (const date of targetDates) {
        // 1. Filter events active on this date
        const dayEvents = events.filter(e => e.startDate === date || e.recurrence !== 'none');

        // 2. Map to numeric intervals [startMinutes, endMinutes]
        let intervals = dayEvents.map(e => ([
            Math.max(timeToMinutes(e.startTime), WORKING_DAY_START_MINUTES),
            Math.min(timeToMinutes(e.endTime), WORKING_DAY_END_MINUTES)
        ]));

        // Filter out events entirely outside working hours
        intervals = intervals.filter(([start, end]) => start < WORKING_DAY_END_MINUTES && end > WORKING_DAY_START_MINUTES);

        // 3. Merge overlapping intervals (O(N log N))
        if (intervals.length === 0) {
            capacityMap[date] = { date, freeMinutes: TOTAL_WORKING_MINUTES };
            continue;
        }

        intervals.sort((a, b) => a[0] - b[0]);
        const merged: number[][] = [intervals[0]];

        for (let i = 1; i < intervals.length; i++) {
            const lastMerged = merged[merged.length - 1];
            const current = intervals[i];

            if (current[0] <= lastMerged[1]) {
                lastMerged[1] = Math.max(lastMerged[1], current[1]); // Overlap found, extend end time
            } else {
                merged.push(current); // No overlap, push new interval
            }
        }

        // 4. Calculate total occupied time and subtract from working day
        const occupiedMinutes = merged.reduce((total, [start, end]) => total + (end - start), 0);
        capacityMap[date] = {
            date,
            freeMinutes: Math.max(0, TOTAL_WORKING_MINUTES - occupiedMinutes)
        };
    }

    return capacityMap;
};


export const TriageOverdueHandler: AIHandler = {
    execute: async (params, context) => {
        const daysToSpread = params.daysToSpread || 3;
        const now = new Date();

        // 1. Gather Overdue Tasks
        const overdueTasks = (context.tasks || []).filter((t: any) =>
            t.status === 'pending' && new Date(t.dueDate) < now
        );

        if (overdueTasks.length === 0) {
            return { output: "You have no overdue tasks to triage! Great job." };
        }

        // 2. Generate target date strings (e.g., next 3 days)
        const targetDates = Array.from({ length: daysToSpread }).map((_, i) => {
            const d = new Date();
            d.setDate(now.getDate() + i + 1); // Start spreading from tomorrow
            return d.toISOString().split('T')[0];
        });

        // 3. Calculate Whitespace Capacity
        const capacityMap = calculateDailyCapacity(context.events || [], targetDates);

        // 4. Sub-Agent LLM Call (Semantic Complexity Estimation)
        // We force the LLM to output a strict JSON mapping of taskId -> newDate


        try {


            const JSONoutput = await exceuteTriageOverdueNode(overdueTasks, daysToSpread, capacityMap);
            const assignments = JSON.parse(JSONoutput.text || '[]');

            // 5. Memory State (Undo Stack)
            AIActionMemory.push({
                type: 'BATCH_REVERT_TASKS',
                payload: { originalTasks: structuredClone(overdueTasks) }
            });

            // 6. Execute atomic DB mutations based on the Sub-Agent's mapping
            // Group by date to minimize DB transactions
            const updatePromises = assignments.map((assignment: any) => {
                const task = context.tasks.filter(t => t.id === assignment.taskId)[0];
                task.dueDate = assignment.newDate;
                context.editTask(task)
            });
            await Promise.all(updatePromises);

            return {
                output: `I've triaged ${overdueTasks.length} overdue tasks across the next ${daysToSpread} days based on your calendar whitespace.`
            };

        } catch (error) {
            console.error("Triage Sub-Agent failed:", error);
            return { error: "Failed to mathematically distribute your tasks. No changes were made." };
        }
    }
};