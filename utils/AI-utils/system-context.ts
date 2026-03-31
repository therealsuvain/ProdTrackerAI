import { format } from 'date-fns';
import { Task } from '../../types/task';
import { Habit } from '../../types/habits';
import { CalendarEvent } from '../../types/calendar';

/**
 * Generates a string representing the current date and time context.
 */
let lastState = {
    tk: [] as any[],
    hb: [] as any[],
    ev: [] as any[]
};

const getTemporalContext = () => {
    const now = new Date();

    return `CD: ${format(now, 'MMMM do yyyy')}, CT: ${format(now, 'h:mm a')}, TO: ${-now.getTimezoneOffset()}mins
  `.trim();
};

const serializeTasks = (tasks: Task[]) => {
    if (tasks.length === 0) return [];
    return tasks.map(t => ({
        i: t.id.slice(0, 8),
        t: t.title,
        d: t.dueDate ? format(new Date(t.dueDate), 'MM/dd/yyyy') : '-',
        p: t.priority,
        c: t.completed ? 1 : 0
    }))
};

const serializeHabits = (habits: Habit[]) => {
    if (habits.length === 0) return [];
    return habits
        .map(h => ({
            i: h.id.slice(0, 8),
            t: h.title,
            cs: h.streak,
            g: h.goal,
            fq: h.frequency,
            f: h.streakFreezes,
            ldc: h.history.length > 0 ? h.history[h.history.length - 1] : '-'
        }))


};

const serializeEvents = (events: CalendarEvent[]) => {
    if (events.length === 0) return [];
    return events.filter(e => new Date(e.endDate) >= new Date()) // Only show upcoming events
        .map(e => ({
            i: e.id.slice(0, 8),
            t: e.title,
            sd: e.startDate ? format(new Date(e.startDate), 'MM/dd/yyyy') : '-',
            ed: e.endDate ? format(new Date(e.endDate), 'MM/dd/yyyy') : '-',
            st: e.startTime ? format(new Date(e.startTime), 'h:mm a') : '-',
            et: e.endTime ? format(new Date(e.endTime), 'h:mm a') : '-',
            r: e.recurrence || '-'
        }))

};

const calculateDiff = (current: any[], last: any[]) => {
    const added = current.filter(c => !last.find(l => l.i === c.i));
    const updated = current.filter(c => {
        const prev = last.find(l => l.i === c.i);
        return prev && JSON.stringify(prev) !== JSON.stringify(c);
    });
    const removedIds = last.filter(l => !current.find(c => c.i === l.i)).map(l => l.i);

    if (!added.length && !updated.length && !removedIds.length) return null;
    return { a: added, u: updated, r: removedIds };
};

export const getAppStatusSnapshot = (context: any) => {
    const currTk = serializeTasks(context.tasks);
    const currHb = serializeHabits(context.habits);
    const currEv = serializeEvents(context.events);

    // Calculate Diffs
    const tkDiff = calculateDiff(currTk, lastState.tk);
    const hbDiff = calculateDiff(currHb, lastState.hb);
    const evDiff = calculateDiff(currEv, lastState.ev);
    const isFirstTime = lastState.tk.length === 0 && lastState.hb.length === 0 && lastState.ev.length === 0;
    lastState = { tk: currTk, hb: currHb, ev: currEv };
    if (isFirstTime) {
        return `${getTemporalContext()},

        tk:[${currTk.map(t => `{i: ${t.i}, t:${t.t}, d: ${t.d}, p: ${t.p}, c: ${t.c}`).join(',\n')}],

        hb:[${currHb.map(h => `{i: ${h.i}, t:${h.t},cs: ${h.cs}, g:${h.g}, fq:${h.fq}, f: ${h.f}, ldc : ${h.ldc}}`).join(',\n')}],

        ev:[${currEv.map(e => `{i: ${e.i}, t:${e.t}, sd: ${e.sd}, ed: ${e.ed}, st: ${e.st}, et: ${e.et}, r: ${e.r}}`).join(',\n')}]`.trim();
    }
    if (!tkDiff && !hbDiff && !evDiff) return null;

    return `PATCH: ${JSON.stringify({ tk: tkDiff, hb: hbDiff, ev: evDiff })}`.replace(/null/g, '[]');
};


// --- CURRENT UI STATE ---
// Active Screen: ${context.navigation.getState()?.routes.slice(-1)[0]?.name || 'Unknown'}
