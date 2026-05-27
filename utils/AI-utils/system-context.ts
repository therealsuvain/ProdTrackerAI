import { format } from 'date-fns';
import { CalendarEvent } from '@/types/calendar';
import { Habit } from '@/types/habits';
import { Task } from '@/types/task';
import { Tag } from '@/types/tag';
import { Category } from '@/types/category';

/**
 * Generates a string representing the current date and time context.
 */
let lastState = {
    tk: [] as any[],
    hb: [] as any[],
    ev: [] as any[],
    cat: [] as any[], 
    tag: [] as any[],
};

const getTemporalContext = () => {
    const now = new Date();

    return `CD: ${format(now, 'MMMM do yyyy')}, CT: ${format(now, 'h:mm a')}, TO: ${now.getTimezoneOffset()}mins
  `.trim();
};
const serializeCategories = (categories: any[]) => {
    if (!categories || categories.length === 0) return [];
    return categories.map(c => ({
        i: c.id.slice(0, 8),
        n: c.name
    }));
};

const serializeTags = (tags: any[]) => {
    if (!tags || tags.length === 0) return [];
    return tags.map(t => ({
        i: t.id.slice(0, 8),
        n: t.name
    }));
};
const serializeTasks = (tasks: Task[]) => {
    if (tasks.length === 0) return [];
    return tasks.map(t => ({
        i: t.id.slice(0, 8),
        t: t.title,
        d: t.dueDate ? format(new Date(t.dueDate), 'MM/dd/yyyy') : '-',
        p: t.priority,
        c: t.completed ? 1 : 0,
        cat: t.category ? t.category.slice(0, 8) : '-',
        tg: t.tags?.length ? t.tags.map(id => id.slice(0, 8)).join('|') : '-',
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
            ldc: h.history.length > 0 ? h.history[h.history.length - 1] : '-',
            cat: h.category ? h.category.slice(0, 8) : '-',
        tg: h.tags?.length ? h.tags.map(id => id.slice(0, 8)).join('|') : '-',
        }))


};

const serializeEvents = (events: CalendarEvent[]) => {
    if (events.length === 0) return [];
    return events.map(e => ({
        i: e.id.slice(0, 8),
        t: e.title,
        sd: e.startDate ? format(new Date(e.startDate), 'MM/dd/yyyy') : '-',
        ed: e.endDate ? format(new Date(e.endDate), 'MM/dd/yyyy') : '-',
        st: e.startTime ? format(new Date(e.startTime), 'h:mm a') : '-',
        et: e.endTime ? format(new Date(e.endTime), 'h:mm a') : '-',
        r: e.recurrence || '-',
        cat: e.category ? e.category.slice(0, 8) : '-',
        tg: e.tags?.length ? e.tags.map(id => id.slice(0, 8)).join('|') : '-'
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
    const currCat = serializeCategories(context.categories);
    const currTag = serializeTags(context.tags);

    // Calculate Diffs
    const tkDiff = calculateDiff(currTk, lastState.tk);
    const hbDiff = calculateDiff(currHb, lastState.hb);
    const evDiff = calculateDiff(currEv, lastState.ev);
    const catDiff = calculateDiff(currCat, lastState.cat);
    const tagDiff = calculateDiff(currTag, lastState.tag);
    const isFirstTime = lastState.tk.length === 0 && lastState.hb.length === 0 && lastState.ev.length === 0;
    lastState = { tk: currTk, hb: currHb, ev: currEv , cat: currCat, tag: currTag};
    if (isFirstTime) {
        return `${getTemporalContext()},

        tk:[${currTk.map(t => `{i: ${t.i}, t:${t.t}, d: ${t.d}, p: ${t.p}, c: ${t.c}, cat: ${t.cat}, tg: ${t.tg}}`).join(',\n')}],

        hb:[${currHb.map(h => `{i: ${h.i}, t:${h.t},cs: ${h.cs}, g:${h.g}, fq:${h.fq}, f: ${h.f}, ldc : ${h.ldc}, cat: ${h.cat}, tg: ${h.tg}}`).join(',\n')}],

        ev:[${currEv.map(e => `{i: ${e.i}, t:${e.t}, sd: ${e.sd}, ed: ${e.ed}, st: ${e.st}, et: ${e.et}, r: ${e.r}, cat: ${e.cat}, tg: ${e.tg}}`).join(',\n')}]`.trim();
    }
    if (!tkDiff && !hbDiff && !evDiff && !catDiff && !tagDiff) return null;

    return `PATCH: ${JSON.stringify({ tk: tkDiff, hb: hbDiff, ev: evDiff, cat: catDiff, tag: tagDiff })}`.replace(/null/g, '[]');
};


// --- CURRENT UI STATE ---
// Active Screen: ${context.navigation.getState()?.routes.slice(-1)[0]?.name || 'Unknown'}
