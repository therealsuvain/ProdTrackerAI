import { supabase } from "./supabase-client";
import {
  db,
  tags,
  categories,
  tasks,
  habits, habitCheckIns, habitFreezeHistory, habitGoalCompletions,
  calendarEvents, eventDeletedOccurrences,
  timerLogs,
  habitTags, eventTags, taskTags, timerTags,
  unlockedAchievements,
  globalMetrics, dailyMetrics, dailyMetricsAI, globalMetricsAI, achievementGlobalMetrics
} from "@/db";
import {
  fetchChildRowsForMany as habitChildRowsMulti,
  buildCheckInRows, buildFreezeRows, buildGoalCompletionRows
} from "@/db/repositories/habit-repository";
import {
  fetchChildRowsForMany as eventChildRowsMulti,
  buildEventDeletedOccurrenceRows
} from "@/db/repositories/event-repository";
import { eq, or, isNull, lt, inArray } from "drizzle-orm";

import { Task } from "@/types/task";
import { Habit } from "@/types/habits";
import { CalendarEvent } from "@/types/calendar";
import { TimerLog } from "@/types/timer";
import { generateEmbedding } from "../embedding-engine";

function isDirty(row: { updatedAt: string; syncedAt: string | null }): boolean {
  if (!row.syncedAt) return true;
  return new Date(row.updatedAt).getTime() > new Date(row.syncedAt).getTime();
}
async function markRowsSynced(
  table: typeof tasks | typeof habits | typeof calendarEvents | typeof timerLogs,
  ids: string[],
  syncedAt: string,
): Promise<void> {
  if (ids.length === 0) return;
  await db.update(table).set({ syncedAt }).where(inArray(table.id, ids));
}

// ── Categories ─────────────────────────────────

export async function pushCategories(userId: string): Promise<void> {
  console.log("[sync] Pushing categories for user:", userId);
  const dirtyRows = await db
    .select()
    .from(categories)
    .where(
      or(
        isNull(categories.syncedAt),
        lt(categories.syncedAt, categories.updatedAt),
      ),
    );

  if (dirtyRows.length === 0) return;

  const payload = dirtyRows.map((row) => ({
    id: row.id,
    user_id: userId,
    icon: row.icon,
    name: row.name,
    color: row.color,
    count: row.count,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));

  const { error } = await supabase.from("categories").upsert(payload);

  if (error) {
    console.error("[sync] Failed to push categories:", error);
    throw error;
  }

  const now = new Date().toISOString();
  await db
    .update(categories)
    .set({ syncedAt: now })
    .where(inArray(categories.id, dirtyRows.map((r) => r.id)));
}

export async function pullCategories(userId: string, since: string | null): Promise<void> {
  console.log("[sync] Pulling categories for user:", userId);
  let query = supabase.from("categories").select("*").eq("user_id", userId);

  if (since) {
    query = query.gt("updated_at", since);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sync] Failed to pull categories:", error);
    throw error;
  }

  if (!data || data.length === 0) return;

  for (const remote of data) {
    const [local] = await db.select().from(categories).where(eq(categories.id, remote.id));

    // Last-write-wins guard — this was missing, and is the actual bug.
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) {
      continue; // local is same-or-newer — don't let a stale/null cloud value overwrite it
    }
    await db
      .insert(categories)
      .values({
        id: remote.id,
        name: remote.name,
        color: remote.color,
        icon: remote.icon,
        count: remote.count,
        createdAt: remote.created_at,
        updatedAt: remote.updated_at,
        syncedAt: remote.updated_at, // just pulled — locally in sync as of now
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: remote.name,
          color: remote.color,
          count: remote.count,
          icon: remote.icon,
          updatedAt: remote.updated_at,
          syncedAt: remote.updated_at,
        },
      });
  }
}

export async function pushTasks(userId: string): Promise<void> {
  const allTasks = await db.select().from(tasks);
  const dirty = allTasks.filter(isDirty);
  if (dirty.length === 0) return;

  const payload = dirty.map((t) => ({
    id: t.id,
    user_id: userId,
    title: t.title,
    description: t.description ?? null,
    due_date: t.dueDate,
    reminder_date: t.reminderDate ?? null,
    reminder: t.reminder ? 1 : 0,
    priority: t.priority ?? "medium",
    completed: t.completed ? 1 : 0,
    completed_at: t.completedAt ?? null,
    category: t.category ?? null,
    tags: t.tags ? JSON.parse(t.tags) : [],               // text[] on the cloud side
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    // notification_id intentionally omitted — local-only field
  }));

  const { error } = await supabase.from("tasks").upsert(payload);
  if (error) {
    console.error("[Sync] Failed to push tasks:", error);
    throw error;
  }

  const syncedAt = new Date().toISOString();
  await markRowsSynced(tasks, dirty.map((t) => t.id), syncedAt);
}

export async function pullTasks(userId: string, since: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);

  if (error) {
    console.error("[Sync] Failed to pull tasks:", error);
    throw error;
  }
  if (!data?.length) return [];

  const pulledTasks: Task[] = [];

  for (const remote of data) {
    const [local] = await db.select().from(tasks).where(eq(tasks.id, remote.id));

    // Last-write-wins: only apply remote if it's actually newer than local
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) {
      continue; // local is same or newer — keep local, don't overwrite
    }
    const contentChanged = !local || local.title !== remote.title

    const embedding = contentChanged
      ? JSON.stringify(await generateEmbedding(remote.title, false))
      : local?.embedding ?? null; // reuse existing embedding — content didn't change

    const mapped: Task = {
      id: remote.id,
      title: remote.title,
      description: remote.description ?? null,
      dueDate: remote.due_date,
      reminderDate: remote.reminder_date ?? null,
      reminder: remote.reminder,
      priority: remote.priority,
      completed: remote.completed,
      completedAt: remote.completed_at ?? null,
      category: remote.category ?? null,
      tags: remote.tags ?? null,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,
      // notificationId intentionally NOT set here — reconciled separately
    };

    await db.transaction(async (tx) => {
      await tx.delete(taskTags).where(eq(taskTags.taskId, mapped.id));
      await tx.insert(tasks)
        .values({
          ...mapped,
          tags: JSON.stringify(mapped.tags),
          embedding,
          syncedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            ...mapped,
            tags: JSON.stringify(mapped.tags),
            embedding,
            syncedAt: new Date().toISOString()
          },
        });


      if (mapped.tags && mapped.tags.length > 0) {
        const junctionData = mapped.tags.map((tagId: string) => ({
          taskId: mapped.id,
          tagId: tagId,
        }));

        await tx.insert(taskTags).values(junctionData);
      }
    });

    pulledTasks.push(mapped);
  }

  return pulledTasks; // caller reconciles notifications + regenerates taskTags junction rows
}

// ─── HABITS ──────────────────────────────────────────────────────────────────


export async function pushHabits(userId: string): Promise<void> {
  const allHabits = await db.select().from(habits);
  const dirty = allHabits.filter(isDirty);
  if (dirty.length === 0) return;
  const dirtyIds = dirty.map((h) => h.id);
  const childrenRow = await habitChildRowsMulti(dirtyIds);
  const payload = dirty.map((h) => {
    const habitId = h.id;
    const { checkIns, freezes, goalCompletionRows } = childrenRow.get(habitId) ?? { checkIns: [], freezes: [], goalCompletionRows: [] };
    return {
      id: h.id,
      user_id: userId,
      title: h.title,
      description: h.description ?? null,
      frequency: h.frequency,
      reminder: h.reminder? 1:0,
      reminder_date: h.reminderDate ?? null,
      target_days: h.targetDays ? JSON.parse(h.targetDays) : null,
      streak: h.streak,
      history: checkIns.map((r) => r.date),
      freeze_history: freezes.length > 0 ? freezes.map((r) => r.date) : undefined,
      goal_completions: goalCompletionRows.map((r) => ({
        completedAt: r.completedAt,
        goal: r.goal,
      })),
      streak_freezes: h.streakFreezes,
      longest_streak: h.longestStreak,
      goal: h.goal,
      pending_streak_reset_after: h.pendingStreakResetAfter ?? null,
      category: h.category ?? null,
      tags: h.tags ? JSON.parse(h.tags) : [],
      created_at: h.createdAt,
      updated_at: h.updatedAt,
    };
  });

  const { error } = await supabase.from("habits").upsert(payload);
  if (error) {
    console.error("[Sync] Failed to push habits:", error);
    throw error;
  }

  const syncedAt = new Date().toISOString();
  await markRowsSynced(habits, dirty.map((h) => h.id), syncedAt);
}

export async function pullHabits(userId: string, since: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);

  if (error) {
    console.error("[Sync] Failed to pull habits:", error);
    throw error;
  }
  if (!data?.length) return [];

  const pulledHabits: Habit[] = [];

  for (const remote of data) {
    const [local] = await db.select().from(habits).where(eq(habits.id, remote.id));
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) continue;

    const contentChanged = !local || local.title !== remote.title

    const embedding = contentChanged
      ? JSON.stringify(await generateEmbedding(remote.title, false))
      : local?.embedding ?? null; // reuse existing embedding — content didn't change

    const mapped: Habit = {
      id: remote.id,
      title: remote.title,
      description: remote.description ?? undefined,
      frequency: remote.frequency,
      reminder: remote.reminder,
      reminderDate: remote.reminder_date ?? undefined,
      targetDays: remote.target_days ?? undefined,
      streak: remote.streak,
      history: remote.history ?? [],
      streakFreezes: remote.streak_freezes,
      longestStreak: remote.longest_streak,
      freezeHistory: remote.freeze_history ?? [],
      goal: remote.goal,
      goalCompletions: remote.goal_completions ?? [],
      pendingStreakResetAfter: remote.pending_streak_reset_after ?? undefined,
      category: remote.category ?? undefined,
      tags: remote.tags ?? [],
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,

    };
    const checkInRows = buildCheckInRows(remote);
    const freezeRows = buildFreezeRows(remote);
    const goalCompletionRows = buildGoalCompletionRows(remote);

    await db.transaction(async (tx) => {
      await tx.delete(habitTags).where(eq(habitTags.habitId, mapped.id));
      await tx.insert(habits)
        .values({
          ...mapped,
          targetDays: JSON.stringify(mapped.targetDays),
          tags: JSON.stringify(mapped.tags),
          embedding,
          syncedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: habits.id,
          set: {
            ...mapped,
            targetDays: JSON.stringify(mapped.targetDays),
            tags: JSON.stringify(mapped.tags),
            embedding,
            syncedAt: new Date().toISOString()
          },
        });

      if (checkInRows.length > 0) {
        await tx.insert(habitCheckIns).values(checkInRows);
      }
      if (freezeRows.length > 0) {
        await tx.insert(habitFreezeHistory).values(freezeRows);
      }
      if (goalCompletionRows.length > 0) {
        await tx.insert(habitGoalCompletions).values(goalCompletionRows);
      }
      if (mapped.tags && mapped.tags.length > 0) {
        const junctionData = mapped.tags.map((tagId: string) => ({
          habitId: mapped.id,
          tagId: tagId,
        }));

        await tx.insert(habitTags).values(junctionData);
      }
    });


    pulledHabits.push(mapped);
  }

  return pulledHabits;
}

// ─── CALENDAR EVENTS ─────────────────────────────────────────────────────────


export async function pushEvents(userId: string): Promise<void> {
  const allEvents = await db.select().from(calendarEvents);
  const dirty = allEvents.filter(isDirty);
  if (dirty.length === 0) return;
  const eventIds = dirty.map((e) => e.id);
  const childrenRow = await eventChildRowsMulti(eventIds);
  const payload = dirty.map((e) => {
    const { deletedOccurrences, notificationIds } = childrenRow.get(e.id) ?? { deletedOccurrences: [], notificationIds: [] };
    return {
      id: e.id,
      user_id: userId,
      title: e.title,
      description: e.description ?? null,
      start_time: e.startTime,
      end_time: e.endTime,
      recurrence: e.recurrence ?? null,
      start_date: e.startDate,
      end_date: e.endDate ?? null,
      category: e.category ?? null,
      tags: e.tags ? JSON.parse(e.tags) : [],
      reminder: e.reminder ?? false,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      deleted_occurrences: deletedOccurrences.length > 0 ? deletedOccurrences.map((r) => r.date) : undefined,
      // notification_ids intentionally omitted
    }
  });

  const { error } = await supabase.from("calendar_events").upsert(payload);
  if (error) {
    console.error("[Sync] Failed to push events:", error);
    throw error;
  }

  const syncedAt = new Date().toISOString();
  await markRowsSynced(calendarEvents, dirty.map((e) => e.id), syncedAt);
}

export async function pullEvents(userId: string, since: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);

  if (error) {
    console.error("[Sync] Failed to pull events:", error);
    throw error;
  }
  if (!data?.length) return [];

  const pulledEvents: CalendarEvent[] = [];

  for (const remote of data) {
    const [local] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, remote.id));
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) continue;
    const contentChanged = !local || local.title !== remote.title

    const embedding = contentChanged
      ? JSON.stringify(await generateEmbedding(remote.title, false))
      : local?.embedding ?? null; // reuse existing embedding — content didn't change
    const deletedOccurrencesRows = buildEventDeletedOccurrenceRows(remote);
    const mapped: CalendarEvent = {
      id: remote.id,
      title: remote.title,
      description: remote.description ?? undefined,
      startTime: remote.start_time,
      endTime: remote.end_time,
      recurrence: remote.recurrence ?? undefined,
      startDate: remote.start_date,
      endDate: remote.recurrence_end_date ?? undefined,
      category: remote.category ?? undefined,
      tags: remote.tags ?? [],
      reminder: remote.reminder,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,

    };
    await db.transaction(async (tx) => {
      await tx.delete(eventTags).where(eq(eventTags.eventId, mapped.id));
      await tx.insert(calendarEvents)
        .values({
          ...mapped,
          tags: JSON.stringify(mapped.tags),
          embedding,
          syncedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: calendarEvents.id,
          set: {
            ...mapped,
            tags: JSON.stringify(mapped.tags),
            embedding,
            syncedAt: new Date().toISOString()
          },
        });

      if (deletedOccurrencesRows.length > 0) {
        await tx.insert(eventDeletedOccurrences).values(deletedOccurrencesRows);
      }

      if (remote.tags && remote.tags.length > 0) {
        const junctionData = remote.tags.map((tagId: string) => ({
          eventId: remote.id,
          tagId: tagId,
        }));
        await tx.insert(eventTags).values(junctionData);
      }
    });

    pulledEvents.push(mapped);
  }

  return pulledEvents;
}

// ─── TIMER LOGS ──────────────────────────────────────────────────────────────


export async function pushLogs(userId: string): Promise<void> {
  const allLogs = await db.select().from(timerLogs);
  const dirty = allLogs.filter(isDirty);
  if (dirty.length === 0) return;

  const payload = dirty.map((l) => ({

    id: l.id,
    user_id: userId,
    title: l.title ?? null,
    start_time: l.startTime,
    end_time: l.endTime,
    duration: l.duration,
    category: l.category ?? null,
    tags: l.tags ? JSON.parse(l.tags) : [],
    laps: l.laps ? JSON.parse(l.laps) : null,
    is_partial: l.isPartial? 1:0,
    created_at: l.createdAt,
    updated_at: l.updatedAt,

  }));

  const { error } = await supabase.from("timer_logs").upsert(payload);
  if (error) {
    console.error("[Sync] Failed to push logs:", error);
    throw error;
  }

  const syncedAt = new Date().toISOString();
  await markRowsSynced(timerLogs, dirty.map((l) => l.id), syncedAt);
}

export async function pullLogs(userId: string, since: string): Promise<TimerLog[]> {
  const { data, error } = await supabase
    .from("timer_logs")
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);

  if (error) {
    console.error("[Sync] Failed to pull logs:", error);
    throw error;
  }
  if (!data?.length) return [];

  const pulledLogs: TimerLog[] = [];

  for (const remote of data) {
    const [local] = await db.select().from(timerLogs).where(eq(timerLogs.id, remote.id));
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) continue;

    const mapped = {
      id: remote.id,
      title: remote.title ?? undefined,
      startTime: remote.start_time,
      endTime: remote.end_time,
      duration: remote.duration,
      category: remote.category ?? undefined,
      tags: remote.tags ?? [],
      laps: remote.laps ?? undefined,
      isPartial: remote.is_partial ?? undefined,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,
    };
    await db.transaction(async (tx) => {
      await tx.delete(timerTags).where(eq(timerTags.logId, mapped.id));
      await tx.insert(timerLogs)
        .values({ ...mapped, tags: JSON.stringify(mapped.tags), laps: JSON.stringify(mapped.laps), syncedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: timerLogs.id,
          set: { ...mapped, tags: JSON.stringify(mapped.tags), laps: JSON.stringify(mapped.laps), syncedAt: new Date().toISOString() },
        });


      if (mapped.tags && mapped.tags.length > 0) {
        const junctionData = mapped.tags.map((tagId: string) => ({
          logId: mapped.id,
          tagId: tagId,
        }));

        await tx.insert(timerTags).values(junctionData);
      }
    });


    pulledLogs.push(mapped);
  }

  return pulledLogs;
}
export async function pushTags(userId: string): Promise<void> {
  const dirtyRows = await db
    .select()
    .from(tags)
    .where(or(isNull(tags.syncedAt), lt(tags.syncedAt, tags.updatedAt)));

  if (dirtyRows.length === 0) return;

  const payload = dirtyRows.map((row) => ({
    id: row.id,
    user_id: userId,
    name: row.name,
    count: row.count,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));

  const { error } = await supabase.from("tags").upsert(payload);
  if (error) {
    console.error("[sync] Failed to push tags:", error);
    throw error;
  }

  const now = new Date().toISOString();
  await db
    .update(tags)
    .set({ syncedAt: now })
    .where(inArray(tags.id, dirtyRows.map((r) => r.id)));
}

export async function pullTags(userId: string, since: string | null): Promise<void> {
  let query = supabase.from("tags").select("*").eq("user_id", userId);
  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query;
  if (error) {
    console.error("[sync] Failed to pull tags:", error);
    throw error;
  }
  if (!data || data.length === 0) return;

  for (const remote of data) {
    const [local] = await db.select().from(tags).where(eq(tags.id, remote.id));
    if (local && new Date(local.updatedAt) >= new Date(remote.updated_at)) continue;

    await db
      .insert(tags)
      .values({
        id: remote.id,
        name: remote.name,
        count: remote.count,
        createdAt: remote.created_at,
        updatedAt: remote.updated_at,
        syncedAt: remote.updated_at,
      })
      .onConflictDoUpdate({
        target: tags.id,
        set: {
          name: remote.name,
          count: remote.count,
          updatedAt: remote.updated_at,
          syncedAt: remote.updated_at,
        },
      });
  }
}

// ─── UNLOCKED ACHIEVEMENTS ───────────────────────────────────────────────────
// UNION merge, not last-write-wins. Once unlocked locally OR in the cloud,
// the result must be unlocked. Never let a stale pull "revert" an unlock.

export async function pushUnlockedAchievements(userId: string): Promise<void> {
  const dirtyRows = await db
    .select()
    .from(unlockedAchievements)
    .where(
      or(
        isNull(unlockedAchievements.syncedAt),
        lt(unlockedAchievements.syncedAt, unlockedAchievements.unlockedAt),
      ),
    );

  if (dirtyRows.length === 0) return;

  const payload = dirtyRows.map((row) => ({
    id: row.id,
    user_id: userId,
    title: row.title,
    description: row.description,
    unlocked_description: row.unlockedDescription,
    tier: row.tier,
    target: row.target,
    unlocked_at: row.unlockedAt,
  }));

  // Upsert is safe here even under union semantics — pushing OUR unlock
  // never removes an unlock, it only ever adds/confirms one.
  const { error } = await supabase.from("unlocked_achievements").upsert(payload);
  if (error) {
    console.error("[sync] Failed to push unlocked achievements:", error);
    throw error;
  }

  const now = new Date().toISOString();
  await db
    .update(unlockedAchievements)
    .set({ syncedAt: now })
    .where(inArray(unlockedAchievements.id, dirtyRows.map((r) => r.id)));
}

export async function pullUnlockedAchievements(userId: string): Promise<void> {
  // No `since` filter — achievements are few and union merge needs the
  // full remote set compared against the full local set, not just recent
  // changes, to correctly detect "unlocked elsewhere, missing locally."
  const { data, error } = await supabase
    .from("unlocked_achievements")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("[sync] Failed to pull unlocked achievements:", error);
    throw error;
  }
  if (!data || data.length === 0) return;

  const localRows = await db.select().from(unlockedAchievements);
  const localIds = new Set(localRows.map((r) => r.id));

  for (const remote of data) {
    if (localIds.has(remote.id)) continue; // already unlocked locally — union means keep it, no overwrite needed

    // Present in cloud, missing locally — this device hasn't unlocked it
    // yet, but another device has. Add it; never skip based on timestamp.
    await db.insert(unlockedAchievements).values({
      id: remote.id,
      title: remote.title,
      description: remote.description,
      unlockedDescription: remote.unlocked_description,
      tier: remote.tier,
      target: remote.target,
      unlockedAt: remote.unlocked_at,
      syncedAt: remote.unlocked_at,
    });
  }
}

// ─── DAILY METRICS ────────────────────────────────────────────────────────────
// Additive merge: metrics are counters, not editable fields. Two devices
// each independently incrementing "tasksAdded" for the same day both
// represent REAL events that both happened — last-write-wins would silently
// drop one device's counts. Sum instead.
//
// Push sends the LOCAL delta since last sync (not the full local total),
// and the cloud-side merge adds that delta onto whatever's already there.
/* function computeMetricsDelta(current: Record<string, number | string | null>, snapshot: Record<string, number | string> | null): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const key of METRIC_COLUMNS) {
    if (typeof current[key] !== "number" || typeof snapshot?.[key] !== "number") continue;
    delta[key] = (current[key] ?? 0) - (snapshot?.[key] ?? 0);
  }
  return delta;
} */
function computeMetricsDelta(
  current: Record<string, number | string | null>,
  snapshot: Record<string, number | string> | null,
): Record<string, number> {
  const delta: Record<string, number> = {};

  for (const key of METRIC_COLUMNS) {
    const currentValue = current[key];
    if (typeof currentValue !== "number") continue; // skip genuinely non-numeric fields

    const snapshotValue = snapshot?.[key];
    const baseline = typeof snapshotValue === "number" ? snapshotValue : 0; // no snapshot yet = baseline 0, not "skip"

    delta[key] = currentValue - baseline;
  }

  return delta;
}

function buildSnapshotFrom(row: Record<string, any>): string {
  return JSON.stringify(
    Object.fromEntries(METRIC_COLUMNS.map((k) => [k, row[k] ?? 0])),
  );
}

const METRIC_COLUMNS = [
  "tasksAdded", "tasksCompleted", "tasksAbandoned", "tasksMissed", "tasksDeleted",
  "habitsAdded", "habitsWithWeeklyGoals", "habitsWithDailyGoals", "habitsAbandoned",
  "habitsCheckedIn", "habitsCheckedInBefore8am", "habitsCheckedInAfter10pm",
  "habitsGoalsCompleted", "habitGoalsRestarted", "habitCheckInsMissed",
  "habitsStreakMaxDaily", "habitsStreakMaxWeekly", "habitsFrozen", "habitsAutoFrozen",
  "habitsDeleted", "eventsAdded", "eventsDeleted", "eventsEarlymorning",
  "eventsLatenight", "eventsOvernight", "eventsDaily", "eventsWeekly",
  "eventsSingleton", "eventsInfinite", "timeTracked", "chatMessagesSent",
  "chatActionsConfirmed", "chatActionsExpired", "chatActionsCancelled",
  "tagsAdded", "tagsAssigned", "tagsDeleted", "categoriesAdded",
  "categoriesAssigned", "categoriesDeleted", "logsAdded", "logsDeleted",
  "tasksEdited", "habitsEdited", "eventsEdited", "logsEdited", "tagsEdited",
  "categoriesEdited",
] as const;

function toSnakeCase(camel: string): string {
  return camel.replace(/[A-Z]|[0-9]+/g, (letter) => `_${letter.toLowerCase()}`);
}

export async function pushDailyMetrics(userId: string): Promise<void> {
  const dirtyRows = await db
    .select()
    .from(dailyMetrics)
    .where(or(isNull(dailyMetrics.syncedAt), lt(dailyMetrics.syncedAt, dailyMetrics.updatedAt)));
  console.log("[sync] Pushing daily metrics for user:", dirtyRows.length);
  if (dirtyRows.length === 0) return;
  const syncedRowDates: string[] = [];
  for (const row of dirtyRows) {
    // Fetch existing cloud row (if any) for this user + date to add onto
    const snapshot = (row as any).syncedSnapshot
      ? JSON.parse((row as any).syncedSnapshot)
      : null;
    const delta = computeMetricsDelta(row, snapshot);
   //console.log("[sync] Pushing daily metrics for user, delta:", delta);
    const hasAnyChange = Object.values(delta).some((v) => v !== 0);
    //console.log("[sync] Pushing daily metrics for user has any change:", hasAnyChange);
    if (!hasAnyChange) continue; // this row's updatedAt moved, but no metric actually changed

    const { data: existing, error: fetchError } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("metric_date", row.date) // assumes local `date` column, e.g. "2026-08-17"
      .maybeSingle();

    if (fetchError) {
      console.error("[sync] Failed to fetch existing daily metric:", fetchError);
      throw fetchError;
    }

    const merged: Record<string, number> = {};
    for (const key of METRIC_COLUMNS) {
      const snakeKey = toSnakeCase(key);
      const localDelta = (row as any)[key] ?? 0;   // local value since it was last zeroed/synced
      const cloudValue = existing ? (existing as any)[snakeKey] ?? 0 : 0;
      merged[snakeKey] = cloudValue + localDelta;
    }

    const { error: upsertError } = await supabase.from("daily_metrics").upsert({
      user_id: userId,
      metric_date: row.date,
      ...merged,
    });

    if (upsertError) {
      console.error("[sync] Failed to push daily metrics:", upsertError);
      throw upsertError;
    }
    await db
      .update(dailyMetrics)
      .set({
        syncedAt: new Date().toISOString(),
        syncedSnapshot: buildSnapshotFrom(row),
      })
      .where(eq(dailyMetrics.date, row.date));

    syncedRowDates.push(row.date);
  }

  /*  const now = new Date().toISOString();
   await db
     .update(dailyMetrics)
     .set({ syncedAt: now, syncedSnapshot: buildSnapshotFrom(row), })
     .where(inArray(dailyMetrics.date, dirtyRows.map((r) => r.date))); */

  // IMPORTANT: after a successful push, local per-day counters should be
  // reset to 0 (not deleted) so the NEXT push only sends the new delta,
  // not the same numbers again. This mirrors how you already zero daily
  // metrics rows going into a new day — same reset logic, triggered by
  // successful sync instead of by date rollover.
}

export async function pullDailyMetrics(userId: string, since: string | null): Promise<void> {
  let query = supabase.from("daily_metrics").select("*").eq("user_id", userId);
  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query;
  if (error) {
    console.error("[sync] Failed to pull daily metrics:", error);
    throw error;
  }
  if (!data || data.length === 0) return;

  for (const remote of data) {
    const [local] = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, remote.metric_date));

    const mapped: Record<string, any> = { date: remote.metric_date };
    for (const key of METRIC_COLUMNS) {
      const snakeKey = toSnakeCase(key);
      // Cloud is the merged/authoritative total post-push — pull sets local
      // to match cloud exactly (not additive on pull, only additive on push).
      mapped[key] = remote[snakeKey] ?? 0;
    }
    const nowSyncedSnapshot = JSON.stringify(
      Object.fromEntries(METRIC_COLUMNS.map((k) => [k, mapped[k]])),
    );

    if (local) {
      await db
        .update(dailyMetrics)
        .set({
          ...mapped,
          syncedAt: new Date().toISOString(),
          syncedSnapshot: nowSyncedSnapshot,
        })
        .where(eq(dailyMetrics.date, remote.metric_date));
    } else {
      // Fixed: spread at the top level — the pasted version nested the
      // whole payload as the VALUE of a `date` key, which is malformed.
      await db.insert(dailyMetrics).values({
        date: remote.metric_date,
        ...mapped,
        syncedAt: new Date().toISOString(),
        syncedSnapshot: nowSyncedSnapshot,
      });
    }
  }
}

// ─── GLOBAL METRICS ───────────────────────────────────────────────────────────
// Same additive-merge principle as daily metrics, but single row per user
// (no date dimension) — matches your local row-id === 1 pattern.

export async function pushGlobalMetrics(userId: string): Promise<void> {
  const [local] = await db.select().from(globalMetrics); // your local single-row table
  if (!local) return;
  /* if (!local || (local.syncedAt && local.updatedAt && new Date(local.syncedAt) >= new Date(local.updatedAt))) {
    return; // nothing dirty
  } */
 console.log("[sync] Pushing global metrics for user, db", JSON.stringify(local));
  const snapshot = local.syncedSnapshot ? JSON.parse(local.syncedSnapshot) : null;
  const delta = computeMetricsDelta(local, snapshot);
  console.log("[sync] Pushing global metrics for user, delta:", delta);
  const hasAnyChange = Object.values(delta).some((v) => v !== 0);
  if (!hasAnyChange) return; // nothing new since last sync — skip the round trip entirely

  const { data: existing, error: fetchError } = await supabase
    .from("global_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("[sync] Failed to fetch existing global metrics:", fetchError);
    throw fetchError;
  }

  const merged: Record<string, number> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    const localDelta = delta[key];
    const cloudValue = existing ? (existing as any)[snakeKey] ?? 0 : 0;
    merged[snakeKey] = cloudValue + localDelta;
  }

  const { error: upsertError } = await supabase.from("global_metrics").upsert({
    user_id: userId,
    ...merged,
  });

  if (upsertError) {
    console.error("[sync] Failed to push global metrics:", upsertError);
    throw upsertError;
  }

  /*  await db.update(globalMetrics).set({ syncedAt: new Date().toISOString() }); */
  await db.update(globalMetrics).set({
    syncedAt: new Date().toISOString(),
    syncedSnapshot: buildSnapshotFrom(local),
  });
  // Same reset consideration as daily metrics — see note above.
}

export async function pullGlobalMetrics(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("global_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[sync] Failed to pull global metrics:", error);
    throw error;
  }
  if (!data) return;

  const mapped: Record<string, any> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    mapped[key] = data[snakeKey] ?? 0;
  }

  const nowSyncedSnapshot = JSON.stringify(
    Object.fromEntries(METRIC_COLUMNS.map((k) => [k, mapped[k]])),
  );

  const [local] = await db.select().from(globalMetrics);
  if (local) {
    await db.update(globalMetrics).set({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  } else {
    await db.insert(globalMetrics).values({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  }
}

export async function pushDailyAIMetrics(userId: string): Promise<void> {
  const dirtyRows = await db
    .select()
    .from(dailyMetricsAI)
    .where(or(isNull(dailyMetricsAI.syncedAt), lt(dailyMetricsAI.syncedAt, dailyMetricsAI.updatedAt)));

  if (dirtyRows.length === 0) return;
  const syncedRowDates: string[] = [];
  for (const row of dirtyRows) {
    const snapshot = (row as any).syncedSnapshot
      ? JSON.parse((row as any).syncedSnapshot)
      : null;
    const delta = computeMetricsDelta(row, snapshot);

    const hasAnyChange = Object.values(delta).some((v) => v !== 0);
    if (!hasAnyChange) continue;

    const { data: existing, error: fetchError } = await supabase
      .from("daily_ai_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("metric_date", row.date)
      .maybeSingle();

    if (fetchError) {
      console.error("[sync] Failed to fetch existing daily AI metric:", fetchError);
      throw fetchError;
    }

    const merged: Record<string, number> = {};
    for (const key of METRIC_COLUMNS) {
      const snakeKey = toSnakeCase(key);
      const localDelta = (row as any)[key] ?? 0;
      const cloudValue = existing ? (existing as any)[snakeKey] ?? 0 : 0;
      merged[snakeKey] = cloudValue + localDelta;
    }

    const { error: upsertError } = await supabase.from("daily_ai_metrics").upsert({
      user_id: userId,
      metric_date: row.date,
      ...merged,
    });

    if (upsertError) {
      console.error("[sync] Failed to push daily AI metrics:", upsertError);
      throw upsertError;
    }
    await db
      .update(dailyMetricsAI)
      .set({
        syncedAt: new Date().toISOString(),
        syncedSnapshot: buildSnapshotFrom(row),
      })
      .where(eq(dailyMetricsAI.date, row.date));

    syncedRowDates.push(row.date);
  }

}

export async function pullDailyAIMetrics(userId: string, since: string | null): Promise<void> {
  let query = supabase.from("daily_ai_metrics").select("*").eq("user_id", userId);
  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query;
  if (error) {
    console.error("[sync] Failed to pull daily AI metrics:", error);
    throw error;
  }
  if (!data || data.length === 0) return;

  for (const remote of data) {
    const [local] = await db.select().from(dailyMetricsAI).where(eq(dailyMetricsAI.date, remote.metric_date));

    const mapped: Record<string, any> = { date: remote.metric_date };
    for (const key of METRIC_COLUMNS) {
      const snakeKey = toSnakeCase(key);
      // Cloud is the merged/authoritative total post-push — pull sets local
      // to match cloud exactly (not additive on pull, only additive on push).
      mapped[key] = remote[snakeKey] ?? 0;
    }
    const nowSyncedSnapshot = JSON.stringify(
      Object.fromEntries(METRIC_COLUMNS.map((k) => [k, mapped[k]])),
    );

    if (local) {
      await db
        .update(dailyMetricsAI)
        .set({
          ...mapped,
          syncedAt: new Date().toISOString(),
          syncedSnapshot: nowSyncedSnapshot,
        })
        .where(eq(dailyMetricsAI.date, remote.metric_date));
    } else {
      // Fixed: spread at the top level — the pasted version nested the
      // whole payload as the VALUE of a `date` key, which is malformed.
      await db.insert(dailyMetricsAI).values({
        date: remote.metric_date,
        ...mapped,
        syncedAt: new Date().toISOString(),
        syncedSnapshot: nowSyncedSnapshot,
      });
    }
  }
}


export async function pushGlobalAIMetrics(userId: string): Promise<void> {
  const [local] = await db.select().from(globalMetricsAI); // your local single-row table
  if (!local) return;
  /* if (!local || (local.syncedAt && local.updatedAt && new Date(local.syncedAt) >= new Date(local.updatedAt))) {
    return; // nothing dirty
  } */
  const snapshot = local.syncedSnapshot ? JSON.parse(local.syncedSnapshot) : null;
  const delta = computeMetricsDelta(local, snapshot);
  const hasAnyChange = Object.values(delta).some((v) => v !== 0);
  if (!hasAnyChange) return; // nothing new since last sync — skip the round trip entirely

  const { data: existing, error: fetchError } = await supabase
    .from("global_ai_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("[sync] Failed to fetch existing global AI metrics:", fetchError);
    throw fetchError;
  }

  const merged: Record<string, number> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    const localDelta = delta[key];
    const cloudValue = existing ? (existing as any)[snakeKey] ?? 0 : 0;
    merged[snakeKey] = cloudValue + localDelta;
  }

  const { error: upsertError } = await supabase.from("global_ai_metrics").upsert({
    user_id: userId,
    ...merged,
  });

  if (upsertError) {
    console.error("[sync] Failed to push global AI metrics:", upsertError);
    throw upsertError;
  }

  /*  await db.update(globalMetrics).set({ syncedAt: new Date().toISOString() }); */
  await db.update(globalMetricsAI).set({
    syncedAt: new Date().toISOString(),
    syncedSnapshot: buildSnapshotFrom(local),
  });
  // Same reset consideration as daily metrics — see note above.
}

export async function pullGlobalAIMetrics(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("global_ai_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[sync] Failed to pull global AI metrics:", error);
    throw error;
  }
  if (!data) return;

  const mapped: Record<string, any> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    mapped[key] = data[snakeKey] ?? 0;
  }

  const nowSyncedSnapshot = JSON.stringify(
    Object.fromEntries(METRIC_COLUMNS.map((k) => [k, mapped[k]])),
  );

  const [local] = await db.select().from(globalMetricsAI);
  if (local) {
    await db.update(globalMetricsAI).set({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  } else {
    await db.insert(globalMetricsAI).values({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  }
}


export async function pushAchievementMetrics(userId: string): Promise<void> {
  const [local] = await db.select().from(achievementGlobalMetrics);
  if (!local) return;

  const snapshot = local.syncedSnapshot ? JSON.parse(local.syncedSnapshot) : null;
  const delta = computeMetricsDelta(local, snapshot);
  const hasAnyChange = Object.values(delta).some((v) => v !== 0);
  if (!hasAnyChange) return;

  const { data: existing, error: fetchError } = await supabase
    .from("achievement_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("[sync] Failed to fetch existing achievement metrics:", fetchError);
    throw fetchError;
  }

  const merged: Record<string, number> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    const localDelta = delta[key];
    const cloudValue = existing ? (existing as any)[snakeKey] ?? 0 : 0;
    merged[snakeKey] = cloudValue + localDelta;
  }

  const { error: upsertError } = await supabase.from("achievement_metrics").upsert({
    user_id: userId,
    ...merged,
  });

  if (upsertError) {
    console.error("[sync] Failed to push achievement metrics:", upsertError);
    throw upsertError;
  }

  await db.update(achievementGlobalMetrics).set({
    syncedAt: new Date().toISOString(),
    syncedSnapshot: buildSnapshotFrom(local),
  });
}

export async function pullAchievementMetrics(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("achievement_metrics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[sync] Failed to pull achievement metrics:", error);
    throw error;
  }
  if (!data) return;

  const mapped: Record<string, any> = {};
  for (const key of METRIC_COLUMNS) {
    const snakeKey = toSnakeCase(key);
    mapped[key] = data[snakeKey] ?? 0;
  }

  const nowSyncedSnapshot = JSON.stringify(
    Object.fromEntries(METRIC_COLUMNS.map((k) => [k, mapped[k]])),
  );

  const [local] = await db.select().from(achievementGlobalMetrics);
  if (local) {
    await db.update(achievementGlobalMetrics).set({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  } else {
    await db.insert(achievementGlobalMetrics).values({ ...mapped, syncedAt: new Date().toISOString(), syncedSnapshot: nowSyncedSnapshot, });
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function syncCategories(userId: string, lastPulledAt: string | null): Promise<void> {

  await pushCategories(userId);
  await pullCategories(userId, lastPulledAt);
}