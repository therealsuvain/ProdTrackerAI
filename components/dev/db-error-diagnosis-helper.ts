import { sqlite } from "@/db";
export function dumpForeignKeys() {
    const tables = sqlite.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    for (const { name } of tables) {
        const fks = sqlite.getAllSync(`PRAGMA foreign_key_list('${name}')`);
        if (fks.length) console.log(name, fks);
    }
    console.log("violations", sqlite.getAllSync("PRAGMA foreign_key_check"));
    console.log("tags", sqlite.getAllSync("SELECT e.id, e.title, j.value AS tag_id FROM calendar_events e, json_each(e.tags) j WHERE j.value NOT IN (SELECT id FROM tags)"));
    console.log("categories", sqlite.getAllSync("SELECT id, title, category FROM calendar_events WHERE category IS NOT NULL AND category NOT IN (SELECT id FROM categories)"));
    console.log("eventTags", sqlite.getAllSync("SELECT e.id, e.title, j.value AS tag_id FROM calendar_events e, json_each(e.tags) j WHERE NOT EXISTS (SELECT 1 FROM event_tags t WHERE t.event_id = e.id AND t.tag_id = j.value)"));
}

export async function withRowContext<T>(table: string, id: string, fn: () => Promise<T>) {
    try { return await fn(); }
    catch (err) { console.error(`[sync] ${table} row ${id} failed`, err); throw err; }
}
/**
 * -- 1. tags referenced by events but absent locally
SELECT e.id, e.title, j.value AS tag_id
FROM calendar_events e, json_each(e.tags) j
WHERE j.value NOT IN (SELECT id FROM tags);

-- 2. categories referenced but absent locally
SELECT id, title, category FROM calendar_events
WHERE category IS NOT NULL AND category NOT IN (SELECT id FROM categories);

-- 3. tag links that never made it into the junction table
SELECT e.id, e.title, j.value AS tag_id
FROM calendar_events e, json_each(e.tags) j
WHERE NOT EXISTS (
  SELECT 1 FROM event_tags t WHERE t.event_id = e.id AND t.tag_id = j.value
);
 */