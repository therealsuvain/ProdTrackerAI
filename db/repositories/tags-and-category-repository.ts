import { eq, desc, sql } from "drizzle-orm";
import { db, tags, categories } from "@/db";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import type { TagRow, TagInsert, CategoryRow, CategoryInsert } from "@/db/schema";
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
export async function totalTagUsageCount(): Promise<number> {
    const result = await db
        .select({ total: sql<number>`COALESCE(SUM(${tags.count}), 0)` })
        .from(tags);
    return result[0]?.total ?? 0;
}

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

export async function updateCategoryColor(
    id: string, color: string,
): Promise<void> {
    await db
        .update(categories)
        .set({
            color,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(categories.id, id));
}

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
export async function deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
}

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
export async function totalCategoryUsageCount(): Promise<number> {
    const result = await db
        .select({ total: sql<number>`COALESCE(SUM(${categories.count}), 0)` })
        .from(categories);
    return result[0]?.total ?? 0;
}