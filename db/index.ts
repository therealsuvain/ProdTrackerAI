/**
 * db/index.ts
 *
 * Single DB connection for the entire app.
 * Import `db` from here wherever you need to query.
 *
 * Setup
 * ─────
 * 1. Install dependencies:
 *      npx expo install expo-sqlite
 *      npm install drizzle-orm
 *      npm install -D drizzle-kit
 *
 * 2. Add to package.json scripts:
 *      "db:generate": "drizzle-kit generate --config=drizzle.config.ts"
 *      "db:studio":   "drizzle-kit studio --config=drizzle.config.ts"
 *
 * 3. Create drizzle.config.ts in project root (see bottom of this file).
 *
 * 4. Run `npm run db:generate` after any schema change. This produces
 *    SQL migration files in db/migrations/. Commit these — they are the
 *    authoritative record of every schema change.
 *
 * 5. Call `initDatabase()` once at app startup before rendering (see
 *    how it's used in DataProvider).
 *
 * WAL mode
 * ────────
 * Write-Ahead Logging is enabled by default in Expo SQLite v14+.
 * This means reads don't block writes and vice-versa — important for
 * background sync later. No extra config needed.
 */

import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

// ─── connection ──────────────────────────────────────────────────────────────

// openDatabaseSync opens or creates the SQLite file.
// The filename is stable — changing it creates a new empty DB.
export const sqlite = openDatabaseSync("prodtracker.db", {
  enableChangeListener: true, // Enables useLiveQuery if you want reactive queries later
});
sqlite.execSync('PRAGMA journal_mode = WAL');
sqlite.execSync("PRAGMA foreign_keys = ON;")
// The Drizzle instance. Pass schema so Drizzle knows all table shapes.
export const db = drizzle(sqlite, { schema });

// ─── migration runner ─────────────────────────────────────────────────────────

/**
 * Run all pending migrations at startup.
 *
 * Must be called BEFORE any queries and BEFORE React renders user data.
 * Called once in DataProvider's initialisation effect.
 *
 * migrate() is idempotent — it tracks which migrations have run in a
 * `__drizzle_migrations` table and only applies new ones. Safe to call
 * on every app start.
 *
 * Error handling: if migration fails (corrupt DB, out of disk space),
 * we rethrow so DataProvider's error handling catches it and can
 * dispatchError to the UI rather than silently failing.
 */
export async function initDatabase(): Promise<void> {
  try {
    // migrations is the folder drizzle-kit generate writes to.
    // The require() call is a Metro bundler pattern for loading the
    // generated migration journal at build time.
    const migrations = require("./migrations/migrations");
    //console.log("[DB] migrations", migrations);
    await migrate(db, migrations.default);
    console.log("[DB] Migrations applied successfully");
    initializeFTS();
  } catch (error) {
    console.error("[DB] Migration failed:", error);
    throw error; // Let DataProvider handle this
  }
}

// ─── type export ─────────────────────────────────────────────────────────────

// Re-export schema so callers only need to import from db/index
export * from "./schema";
export const initializeFTS = async () => {
  // 1. Create the Virtual Table
  await db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      text,
      content='messages',
      content_rowid='id'
    );
  `);

  // 2. Create the Triggers to keep it synced
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
    END;
  `);

  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, text) VALUES('delete', old.id, old.text);
      INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
    END;
  `);

  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, text) VALUES('delete', old.id, old.text);
    END;
  `);
};
/**
 * ============================================================
 * drizzle.config.ts  — create this in your PROJECT ROOT
 * ============================================================
 *
 * import type { Config } from "drizzle-kit";
 *
 * export default {
 *   schema: "./db/schema.ts",
 *   out: "./db/migrations",
 *   dialect: "sqlite",
 *   driver: "expo",         // tells drizzle-kit to generate Expo SQLite compatible SQL
 * } satisfies Config;
 *
 * ============================================================
 */