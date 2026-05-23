import { eq, desc, sql, like, and } from "drizzle-orm";
import { db, tags, categories, tasks, habits, calendarEvents, timerLogs, timerTags , taskTags, habitTags, eventTags} from "@/db";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import { type TagRow, type TagInsert, type CategoryRow, type CategoryInsert } from "@/db/schema";
import { DEFAULT_CATEGORIES } from '@/constants/default-categories';



// ─── type converters — Tags ───────────────────────────────────────────────────

/** DB row → application Tag. Called on every read. */
function rowToTag(row: TagRow): Tag {
    return {
        id: row.id,
        name: row.name,
        count: row.count,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Application Tag → DB insert shape. Called on every write. */
function tagToInsert(tag: Tag): TagInsert {
    const now = new Date().toISOString();
    return {
        id: tag.id,
        name: tag.name,
        count: tag.count ?? 0,
        createdAt: tag.createdAt ?? now,
        updatedAt: now, // always stamp updatedAt to now on any write
    };
}

// ─── type converters — Categories ─────────────────────────────────────────────

/** DB row → application Category. Called on every read. */
function rowToCategory(row: CategoryRow): Category {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        count: row.count,
        icon: row.icon,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Application Category → DB insert shape. Called on every write. */
function categoryToInsert(category: Category): CategoryInsert {
    const now = new Date().toISOString();
    return {
        id: category.id,
        name: category.name,
        color: category.color,
        count: category.count ?? 0,
        icon: category.icon,
        createdAt: category.createdAt ?? now,
        updatedAt: now, // always stamp updatedAt to now on any write
    };
}

// ─── Tags: read operations ────────────────────────────────────────────────────

/** Load all tags ordered by usage count descending (most used first). */
export async function getAllTags(): Promise<Tag[]> {
    const rows = await db
        .select()
        .from(tags)
        .orderBy(desc(tags.count));
    return rows.map(rowToTag);
}

// ─── Tags: write operations ───────────────────────────────────────────────────

/**
 * Insert a new tag. Returns the inserted tag with server-stamped updatedAt.
 * Throws on DB error — caller is responsible for catching and rolling back
 * optimistic UI state.
 */
export async function insertTags(tagList: Tag[]): Promise<void> {
    if (tagList.length === 0) return;
    await db.transaction(async (tx) => {
        for (const tag of tagList) {
            await tx
                .insert(tags)
                .values(tagToInsert(tag))
                .onConflictDoUpdate({
                    target: tags.name, // Triggers when the unique 'name' already exists
                    set: {
                        count: sql`${tags.count} + 1`,
                        updatedAt: new Date().toISOString(),
                    }
                }); // safe to re-run migration
        }
    });
}

/**
 * Update a tag's count field only.
 * More efficient than a full-row update since count is the only
 * field that changes during normal app usage.
 */
export async function incrementTagCount(id: string): Promise<void> {
    await db
        .update(tags)
        .set({
            count: sql`${tags.count} + 1`,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(tags.id, id));
}

/**
 * Full tag update. Use updateTagCount instead unless name also needs updating.
 * Merges the provided fields and stamps updatedAt.
 * Throws on DB error.
 */
export async function updateTag(tag: Tag): Promise<Tag> {
    const insert = tagToInsert(tag);
    await db
        .update(tags)
        .set({
            ...insert,
            updatedAt: new Date().toISOString(), // explicit — tagToInsert also sets it
        })
        .where(eq(tags.id, tag.id));
    return rowToTag({ ...insert } as TagRow);
}

/**
 * Delete a tag by id.
 * Throws on DB error.
 */
export async function deleteTag(id: string): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
}

/**
 * Permanently delete every row in the tags table.
 * Returns the number of tags deleted.
 */

export const deleteTagSafely = async (tagIdToDelete: string, fallbackTagId: string | null = null) => {
  await db.transaction(async (tx) => {
    
    if (fallbackTagId) {
      // --- 1. TASKS MIGRATION ---
      const tasksWithOldTag = await tx.select({ taskId: taskTags.taskId }).from(taskTags).where(eq(taskTags.tagId, tagIdToDelete));
      if (tasksWithOldTag.length > 0) {
        // Bulk insert the fallback tag. If the task already has it, SQLite ignores the duplicate instantly.
        await tx.insert(taskTags)
          .values(tasksWithOldTag.map(t => ({ taskId: t.taskId, tagId: fallbackTagId })))
          .onConflictDoNothing();
      }

      // --- 2. HABITS MIGRATION ---
      const habitsWithOldTag = await tx.select({ habitId: habitTags.habitId }).from(habitTags).where(eq(habitTags.tagId, tagIdToDelete));
      if (habitsWithOldTag.length > 0) {
        await tx.insert(habitTags)
          .values(habitsWithOldTag.map(h => ({ habitId: h.habitId, tagId: fallbackTagId })))
          .onConflictDoNothing();
      }

      // --- 3. EVENTS MIGRATION ---
      const eventsWithOldTag = await tx.select({ eventId: eventTags.eventId }).from(eventTags).where(eq(eventTags.tagId, tagIdToDelete));
      if (eventsWithOldTag.length > 0) {
        await tx.insert(eventTags)
          .values(eventsWithOldTag.map(e => ({ eventId: e.eventId, tagId: fallbackTagId })))
          .onConflictDoNothing();
      }

      // --- 4. TIMER LOGS MIGRATION ---
      const logsWithOldTag = await tx.select({ logId: timerTags.logId }).from(timerTags).where(eq(timerTags.tagId, tagIdToDelete));
      if (logsWithOldTag.length > 0) {
        await tx.insert(timerTags)
          .values(logsWithOldTag.map(l => ({ logId: l.logId, tagId: fallbackTagId })))
          .onConflictDoNothing();
      }
    }

    // --- 5. CLEANUP ---
    // Now that the fallback tags are safely duplicated across all items, wipe the old tag entirely.
    await tx.delete(taskTags).where(eq(taskTags.tagId, tagIdToDelete));
    await tx.delete(habitTags).where(eq(habitTags.tagId, tagIdToDelete));
    await tx.delete(eventTags).where(eq(eventTags.tagId, tagIdToDelete));
    await tx.delete(timerTags).where(eq(timerTags.tagId, tagIdToDelete));

    // Finally, safe to delete the actual tag from the dictionary
    await tx.delete(tags).where(eq(tags.id, tagIdToDelete));
  });
};

/* export const deleteTagSafely = async (tagIdToDelete: string, fallbackTagId: string | null = null) => {
  await db.transaction(async (tx) => {
    
    if (fallbackTagId) {
      // Helper to safely reassign junction rows
      const reassignJunction = async (table: any, itemColumn: any, tagColumn: any) => {
        // 1. Find all items linked to the deleted tag
        const linkedItems = await tx.select().from(table).where(eq(tagColumn, tagIdToDelete));
        
        for (const link of linkedItems) {
          // 2. Check if the item ALREADY has the fallback tag
          const itemId = link[itemColumn.name];

          const existingFallback = await tx.select().from(table)
            .where(and(
                eq(itemColumn, itemId),
                eq(tagColumn, fallbackTagId)
              ));
          
          if (existingFallback.length === 0) {
            // 3a. It doesn't have it, so we safely update the old tag to the new tag
            await tx.update(table)
              .set({ [tagColumn.name]: fallbackTagId })
              .where(and(
                  eq(itemColumn, itemId),
                  eq(tagColumn, tagIdToDelete)
                ));
          } else {
            // 3b. It already has the fallback tag! We just delete the old row to prevent duplicates.
            await tx.delete(table)
              .where(and(
                  eq(itemColumn, itemId),
                  eq(tagColumn, tagIdToDelete)
                ));
          }
        }
      };

      // Run reassignment for all junction tables
      await reassignJunction(taskTags, taskTags.taskId, taskTags.tagId);
      await reassignJunction(habitTags, habitTags.habitId, habitTags.tagId);
      await reassignJunction(eventTags, eventTags.eventId, eventTags.tagId);
      await reassignJunction(timerTags, timerTags.logId, timerTags.tagId);
    } else {
      // Hard delete: Just wipe the junction rows if no fallback is selected
      await tx.delete(taskTags).where(eq(taskTags.tagId, tagIdToDelete));
      await tx.delete(habitTags).where(eq(habitTags.tagId, tagIdToDelete));
      await tx.delete(eventTags).where(eq(eventTags.tagId, tagIdToDelete));
      await tx.delete(timerTags).where(eq(timerTags.tagId, tagIdToDelete));
    }

    // Finally, safe to delete the actual tag
    await tx.delete(tags).where(eq(tags.id, tagIdToDelete));
  });
}; */

/* export const deleteTagSafely = async (tagIdToDelete: string, fallbackTagId: string | null = null) => {
  await db.transaction(async (tx) => {
    
    // Helper function to safely reassign tags inside JSON arrays
    const processItems = async (table: any, tagsColumn: any) => {
      // Find all items that contain the tag ID we are deleting
      const items = await tx.select().from(table).where(like(tagsColumn, `%${tagIdToDelete}%`));
      
      for (const item of items) {
        let currentTags: string[] = item.tags || [];
        
        // 1. Remove the deleted tag
        let newTags = currentTags.filter(id => id !== tagIdToDelete);
        
        // 2. Add the fallback tag (ONLY if it isn't already in the array to prevent duplicates)
        if (fallbackTagId && !newTags.includes(fallbackTagId)) {
          newTags.push(fallbackTagId);
        }
        
        // 3. Update the row
        await tx.update(table).set({ tags: newTags }).where(eq(table.id, item.id));
      }
    };

    // Execute the cleanup for all 4 domains
    await processItems(tasks, tasks.tags);
    await processItems(habits, habits.tags);
    await processItems(calendarEvents, calendarEvents.tags);
    await processItems(timerLogs, timerLogs.tags);

    // Finally, safe to delete the tag
    await tx.delete(tags).where(eq(tags.id, tagIdToDelete));
  });
}; */

export async function deleteAllTags(): Promise<number> {
    const count = await countTags();
    if (count === 0) return 0;

    await db.delete(tags);

    return count;
}

// ─── Tags: aggregate operations ───────────────────────────────────────────────

/** Count all tag rows. */
export async function countTags(): Promise<number> {
    const result = await db.select({ id: tags.id }).from(tags);
    return result.length;
}

/**
 * Sum of all count values across every tag row.
 * Represents total tag usage across all items in the app.
 * Returns 0 if there are no tags.
 */
export const getTagUsageStats = async (tagId: string) => {
  // Execute parallel count queries for maximum performance
  const [taskCount, habitCount, eventCount, logCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(taskTags).where(eq(taskTags.tagId, tagId)),
    db.select({ count: sql<number>`count(*)` }).from(habitTags).where(eq(habitTags.tagId, tagId)),
    db.select({ count: sql<number>`count(*)` }).from(eventTags).where(eq(eventTags.tagId, tagId)),
    db.select({ count: sql<number>`count(*)` }).from(timerTags).where(eq(timerTags.tagId, tagId)),
  ]);

  return {
    tasks: taskCount[0].count,
    habits: habitCount[0].count,
    events: eventCount[0].count,
    logs: logCount[0].count,
    // Calculate total dynamically
    total: taskCount[0].count + habitCount[0].count + eventCount[0].count + logCount[0].count
  };
};

// ─── Categories: read operations ──────────────────────────────────────────────

export async function seedCategoriesIfEmpty(): Promise<void> {
    const existingCount = await db.select({ count: sql`COUNT(*)` }).from(categories);

    // Check if the table is empty
    if (existingCount[0].count === 0) {
        await db.insert(categories).values(DEFAULT_CATEGORIES);
        console.log('Database seeded with default categories.');
    }


}
/** Load all categories ordered by usage count descending (most used first). */
export async function getAllCategories(): Promise<Category[]> {
    const rows = await db
        .select()
        .from(categories)
        .orderBy(desc(categories.count));
    return rows.map(rowToCategory);
}

// ─── Categories: write operations ─────────────────────────────────────────────

/**
 * Insert a new category. Returns the inserted category with server-stamped updatedAt.
 * Throws on DB error — caller is responsible for catching and rolling back
 * optimistic UI state.
 */
export async function insertCategory(category: Category): Promise<Category> {
    const insert = categoryToInsert(category);
    await db.insert(categories).values(insert).onConflictDoUpdate({
        target: categories.name, // Triggers when the unique 'name' already exists
        set: {
            count: sql`${categories.count} + 1`,
            updatedAt: new Date().toISOString(),
        }
    });;
    // Return with the exact timestamps that were written
    return rowToCategory({ ...insert } as CategoryRow);
}

/**
 * Update a category's count and/or color fields only.
 * More efficient than a full-row update since these are the only
 * fields that change during normal app usage.
 * Pass only the fields you want to change — undefined fields are left as-is.
 */
export async function incrementCategoryCount(
    id: string,
): Promise<void> {
    await db
        .update(categories)
        .set({
            count: sql`${categories.count} + 1`,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(categories.id, id));
}

/* export async function updateCategoryColor(
    id: string, color: string,
): Promise<void> {
    await db
        .update(categories)
        .set({
            color,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(categories.id, id));
} */

/**
 * Full category update. Use updateCategoryFields unless name also needs updating.
 * Merges the provided fields and stamps updatedAt.
 * Throws on DB error.
 */
export async function updateCategory(category: Category): Promise<Category> {
    const insert = categoryToInsert(category);
    await db
        .update(categories)
        .set({
            ...insert,
            updatedAt: new Date().toISOString(), // explicit — categoryToInsert also sets it
        })
        .where(eq(categories.id, category.id));
    return rowToCategory({ ...insert } as CategoryRow);
}

/**
 * Delete a category by id.
 * Throws on DB error.
 */
export const deleteCategorySafely = async (categoryIdToDelete: string, fallbackCategoryId: string | null = null) => {
  // Use a transaction to ensure all reassignments and the deletion succeed or fail together
  await db.transaction(async (tx) => {
    // If a fallback is provided, migrate all attached items
    if (fallbackCategoryId) {
      await tx.update(tasks).set({ category: fallbackCategoryId }).where(eq(tasks.category, categoryIdToDelete));
      await tx.update(habits).set({ category: fallbackCategoryId }).where(eq(habits.category, categoryIdToDelete));
      await tx.update(calendarEvents).set({ category: fallbackCategoryId }).where(eq(calendarEvents.category, categoryIdToDelete));
      await tx.update(timerLogs).set({ category: fallbackCategoryId }).where(eq(timerLogs.category, categoryIdToDelete));
      // await tx.update(logs).set({ categoryId: fallbackCategoryId }).where(eq(logs.categoryId, categoryIdToDelete));
    }

    // Now safe to delete the category
    await tx.delete(categories).where(eq(categories.id, categoryIdToDelete));
  });
};

/**
 * Permanently delete every row in the categories table.
 * Returns the number of categories deleted.
 */
export async function deleteAllCategories(): Promise<number> {
    const count = await countCategories();
    if (count === 0) return 0;

    await db.delete(categories);

    return count;
}

// ─── Categories: aggregate operations ─────────────────────────────────────────

/** Count all category rows. */
export async function countCategories(): Promise<number> {
    const result = await db.select({ id: categories.id }).from(categories);
    return result.length;
}

/**
 * Sum of all count values across every category row.
 * Represents total category usage across all items in the app.
 * Returns 0 if there are no categories.
 */
export const getCategoryUsage = async (categoryId: string) => {
  // Execute parallel counts for maximum performance
  const [taskCount, habitCount, eventCount, logCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(sql`${tasks.category} = ${categoryId}`),
    db.select({ count: sql<number>`count(*)` }).from(habits).where(sql`${habits.category} = ${categoryId}`),
    db.select({ count: sql<number>`count(*)` }).from(calendarEvents).where(sql`${calendarEvents.category} = ${categoryId}`),
    db.select({ count: sql<number>`count(*)` }).from(timerLogs).where(sql`${timerLogs.category} = ${categoryId}`),
    // db.select({ count: sql<number>`count(*)` }).from(logs).where(sql`${logs.categoryId} = ${categoryId}`),
  ]);

  return {
    tasks: taskCount[0].count,
    habits: habitCount[0].count,
    events: eventCount[0].count,
    logs: logCount[0].count, // logCount[0].count
    total: taskCount[0].count + habitCount[0].count + eventCount[0].count  + logCount[0].count 
  };
};