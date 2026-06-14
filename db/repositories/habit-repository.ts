// ─── DIFF for db/repositories/habit-repository.ts ────────────────────────────
//
// Summary of changes from your current version:
//
// 1. Import child tables from schema
// 2. rowToHabit() → handles parent row only, returns Habit with empty arrays
//    (private, never exported — callers use assembleHabit instead)
// 3. NEW: assembleHabit() → combines parent row + child rows into full Habit
// 4. NEW: fetchChildRows() → loads all 3 child tables for a habit id
// 5. getAllHabits() → now fetches all child rows and assembles full Habits
// 6. getHabitById() → same
// 7. insertHabit() → now writes parent + child rows in one transaction
// 8. updateHabit() → now replaces child rows (delete + reinsert) in one tx
// 9. bulkInsertHabits() → now writes parent + child rows per habit
// 10. FIXED: reminderDate conversion Date → unix ms (was passing Date object directly)
//
// ─────────────────────────────────────────────────────────────────────────────

import { eq, asc, desc, inArray } from "drizzle-orm";
import { db, habits, habitCheckIns, habitFreezeHistory, habitGoalCompletions, habitTags } from "@/db";
import type { Habit, GoalCompletion } from "@/types/habits";
import type {
    HabitRow,
    HabitInsert,
    HabitCheckInRow,
    HabitFreezeRow,
    HabitGoalCompletionRow,
} from "@/db/schema";

// ─── private: parent row converter ───────────────────────────────────────────
//
// Intentionally private — only assembleHabit() produces a full Habit.
// rowToHabit handles the scalar fields on the habits table only.
// history / freezeHistory / goalCompletions are NOT populated here.

function rowToHabit(
    row: HabitRow,
    checkIns: HabitCheckInRow[],
    freezes: HabitFreezeRow[],
    goalCompletionRows: HabitGoalCompletionRow[],
): Habit {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        frequency: row.frequency,
        reminder: row.reminder,
        // FIXED: reminderDate stored as INTEGER (unix ms), convert back to Date
        reminderDate: row.reminderDate ?? undefined,
        targetDays: row.targetDays ? JSON.parse(row.targetDays) : undefined,
        streak: row.streak,
        longestStreak: row.longestStreak,
        streakFreezes: row.streakFreezes,
        goal: row.goal,
        pendingStreakResetAfter: row.pendingStreakResetAfter ?? undefined,
        notificationId: row.notificationId ?? undefined,
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        category: row.category ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        // ── child table data assembled here ──────────────────────────────────
        // history: ISO date strings from habit_check_ins
        history: checkIns.map((r) => r.date),

        // freezeHistory: ISO date strings from habit_freeze_history
        freezeHistory: freezes.length > 0 ? freezes.map((r) => r.date) : undefined,

        // goalCompletions: from habit_goal_completions
        goalCompletions: goalCompletionRows.map(
            (r): GoalCompletion => ({
                completedAt: r.completedAt,
                goal: r.goal,
            }),
        ),
    };
}

// ─── private: child row builders ─────────────────────────────────────────────

function buildCheckInRows(
    habit: Habit,
): Omit<HabitCheckInRow, never>[] {
    //console.log('buildCheckInRows', habit.history);
    return (habit.history ?? []).map((date) => ({
        id: `${habit.id}_ci_${date}`,   // deterministic id — safe to re-insert
        habitId: habit.id,
        date,
    }));
}

function buildFreezeRows(
    habit: Habit,
): Omit<HabitFreezeRow, never>[] {
    return (habit.freezeHistory ?? []).map((date) => ({
        id: `${habit.id}_fr_${date}`,   // deterministic id
        habitId: habit.id,
        date,
    }));
}

function buildGoalCompletionRows(
    habit: Habit,
): Omit<HabitGoalCompletionRow, never>[] {
    return (habit.goalCompletions ?? []).map((gc, idx) => ({
        id: `${habit.id}_gc_${idx}_${gc.completedAt}`,
        habitId: habit.id,
        completedAt: gc.completedAt,
        goal: gc.goal,
    }));
}

// ─── private: fetch child rows for one or many habits ────────────────────────

interface ChildRows {
    checkIns: HabitCheckInRow[];
    freezes: HabitFreezeRow[];
    goalCompletionRows: HabitGoalCompletionRow[];
}

/** Fetch all child rows for a single habit id. */
async function fetchChildRowsForOne(habitId: string): Promise<ChildRows> {
    const [checkIns, freezes, goalCompletionRows] = await Promise.all([
        db.select().from(habitCheckIns).where(eq(habitCheckIns.habitId, habitId)),
        db.select().from(habitFreezeHistory).where(eq(habitFreezeHistory.habitId, habitId)),
        db.select().from(habitGoalCompletions).where(eq(habitGoalCompletions.habitId, habitId)),
    ]);
    return { checkIns, freezes, goalCompletionRows };
}

/**
 * Fetch child rows for many habits in 3 queries (not N*3).
 * Returns a map keyed by habitId so assembly is O(1) per habit.
 */
async function fetchChildRowsForMany(
    habitIds: string[],
): Promise<Map<string, ChildRows>> {
    if (habitIds.length === 0) return new Map();

    const [allCheckIns, allFreezes, allGoalCompletions] = await Promise.all([
        db.select().from(habitCheckIns).where(inArray(habitCheckIns.habitId, habitIds)),
        db.select().from(habitFreezeHistory).where(inArray(habitFreezeHistory.habitId, habitIds)),
        db.select().from(habitGoalCompletions).where(inArray(habitGoalCompletions.habitId, habitIds)),
    ]);

    // Group by habitId
    const map = new Map<string, ChildRows>();
    for (const id of habitIds) {
        map.set(id, { checkIns: [], freezes: [], goalCompletionRows: [] });
    }
    for (const row of allCheckIns) map.get(row.habitId)!.checkIns.push(row);
    for (const row of allFreezes) map.get(row.habitId)!.freezes.push(row);
    for (const row of allGoalCompletions) map.get(row.habitId)!.goalCompletionRows.push(row);

    return map;
}

// ─── parent row insert shape ──────────────────────────────────────────────────

function habitToInsert(habit: Habit): HabitInsert {
    const now = new Date().toISOString();
    console.log("habit repo", habit.reminderDate ?? null);
    return {
        id: habit.id,
        title: habit.title,
        description: habit.description,
        frequency: habit.frequency,
        reminder: habit.reminder,
        reminderDate: habit.reminderDate ?? null,
        targetDays: habit.targetDays ? JSON.stringify(habit.targetDays) : null,
        streak: habit.streak ?? 0,
        longestStreak: habit.longestStreak ?? 0,
        streakFreezes: habit.streakFreezes ?? 1,
        goal: habit.goal ?? 7,
        pendingStreakResetAfter: habit.pendingStreakResetAfter ?? null,
        notificationId: habit.notificationId ?? null,
        category: habit.category ?? null,
        tags: habit.tags ? JSON.stringify(habit.tags) : null,
        embedding: habit.embedding ? JSON.stringify(habit.embedding) : null,
        createdAt: habit.createdAt ?? now,
        updatedAt: now,
    };
}

// ─── read operations ──────────────────────────────────────────────────────────

/** Load all habits with their full child data. 3 + 1 queries total, not N*3. */
export async function getAllHabits(): Promise<Habit[]> {
    const rows = await db
        .select()
        .from(habits)
        .orderBy(asc(habits.createdAt));

    if (rows.length === 0) return [];

    const habitIds = rows.map((r) => r.id);
    const childMap = await fetchChildRowsForMany(habitIds);

    return rows.map((row) => {
        const children = childMap.get(row.id) ?? {
            checkIns: [],
            freezes: [],
            goalCompletionRows: [],
        };
        return rowToHabit(row, children.checkIns, children.freezes, children.goalCompletionRows);
    });
}

/** Load a single habit with all child data. */
export async function getHabitById(id: string): Promise<Habit | null> {
    const rows = await db
        .select()
        .from(habits)
        .where(eq(habits.id, id))
        .limit(1);

    if (rows.length === 0) return null;

    const { checkIns, freezes, goalCompletionRows } = await fetchChildRowsForOne(id);
    return rowToHabit(rows[0], checkIns, freezes, goalCompletionRows);
}

// ─── write operations ─────────────────────────────────────────────────────────

/**
 * Insert a new habit with all child rows in a single transaction.
 * Throws on DB error.
 */
export async function insertHabit(habit: Habit): Promise<Habit> {
    const checkInRows = buildCheckInRows(habit);
    const freezeRows = buildFreezeRows(habit);
    const goalCompletionRows = buildGoalCompletionRows(habit);
    console.log("HABIT REPO:", habitToInsert(habit).reminderDate)
    await db.transaction(async (tx) => {
        await tx.insert(habits).values(habitToInsert(habit));

        if (checkInRows.length > 0) {
            await tx.insert(habitCheckIns).values(checkInRows);
        }
        if (freezeRows.length > 0) {
            await tx.insert(habitFreezeHistory).values(freezeRows);
        }
        if (goalCompletionRows.length > 0) {
            await tx.insert(habitGoalCompletions).values(goalCompletionRows);
        }
        if (habit.tags && habit.tags.length > 0) {
            const junctionData = habit.tags.map((tagId) => ({
                habitId: habit.id,
                tagId: tagId,
            }));

            await tx.insert(habitTags).values(junctionData);
        }
    });

    // Return the full assembled habit
    return habit;
}

/**
 * Update a habit. Replaces all child rows (delete + reinsert) in one transaction.
 *
 * Why delete + reinsert instead of diffing?
 * Check-ins and freezes are append-only in practice, but goalCompletions
 * can be modified (goal value changes). A full replace is simpler and safe —
 * the transaction guarantees atomicity so there's no window where child rows
 * are missing.
 */
export async function updateHabit(habit: Habit): Promise<Habit> {
    const checkInRows = buildCheckInRows(habit);
    const freezeRows = buildFreezeRows(habit);
    const goalCompletionRows = buildGoalCompletionRows(habit);
    //console.log('updateHabit', checkInRows, freezeRows, goalCompletionRows);

    await db.transaction(async (tx) => {
        // Update parent
        await tx
            .update(habits)
            .set({ ...habitToInsert(habit), updatedAt: new Date().toISOString() })
            .where(eq(habits.id, habit.id));

        // Replace children — delete all then reinsert
        await tx.delete(habitCheckIns).where(eq(habitCheckIns.habitId, habit.id));
        await tx.delete(habitFreezeHistory).where(eq(habitFreezeHistory.habitId, habit.id));
        await tx.delete(habitGoalCompletions).where(eq(habitGoalCompletions.habitId, habit.id));

        if (checkInRows.length > 0) {
            await tx.insert(habitCheckIns).values(checkInRows);
        }
        if (freezeRows.length > 0) {
            await tx.insert(habitFreezeHistory).values(freezeRows);
        }
        if (goalCompletionRows.length > 0) {
            await tx.insert(habitGoalCompletions).values(goalCompletionRows);
        }

        await tx
            .delete(habitTags)
            .where(eq(habitTags.habitId, habit.id));

        if (habit.tags && habit.tags.length > 0) {
            const junctionData = habit.tags.map((tagId) => ({
                habitId: habit.id,
                tagId: tagId,
            }));

            await tx.insert(habitTags).values(junctionData);
        }
    });

    return habit;
}

/**
 * Delete a habit and all its child rows.
 * ON DELETE CASCADE in the schema handles child deletion automatically.
 */
export async function deleteHabit(id: string): Promise<void> {
    await db.delete(habits).where(eq(habits.id, id));
}

// ─── bulk operations ──────────────────────────────────────────────────────────

/**
 * Insert multiple habits with all their child rows.
 * Used by the AsyncStorage → SQLite migration.
 */
export async function bulkInsertHabits(habitList: Habit[]): Promise<void> {
    if (habitList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const habit of habitList) {
            // Parent — skip if already exists
            await tx
                .insert(habits)
                .values(habitToInsert(habit))
                .onConflictDoNothing();

            // Children — onConflictDoNothing is safe because ids are deterministic
            const checkInRows = buildCheckInRows(habit);
            const freezeRows = buildFreezeRows(habit);
            const goalRows = buildGoalCompletionRows(habit);

            if (checkInRows.length > 0) {
                await tx.insert(habitCheckIns).values(checkInRows).onConflictDoNothing();
            }
            if (freezeRows.length > 0) {
                await tx.insert(habitFreezeHistory).values(freezeRows).onConflictDoNothing();
            }
            if (goalRows.length > 0) {
                await tx.insert(habitGoalCompletions).values(goalRows).onConflictDoNothing();
            }
        }
    });
}

export async function deleteAllHabits(): Promise<number> {
    const count = await countHabits();
    if (count === 0) return 0;

    await db.delete(habits);

    return count;
}

export async function countHabits(): Promise<number> {
    const result = await db.select({ id: habits.id }).from(habits);
    return result.length;
}