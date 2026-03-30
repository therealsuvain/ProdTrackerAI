/**
 * drizzle.config.ts
 *
 * Place this in your PROJECT ROOT (same level as package.json).
 *
 * After any schema change:
 *   npm run db:generate   → writes new SQL file to db/migrations/
 *   (commit the generated file — it's part of the source of truth)
 *
 * To browse your local DB visually:
 *   npm run db:studio
 */

import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  driver: "expo",
} satisfies Config;