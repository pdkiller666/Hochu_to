/**
 * Идемпотентная SQL-миграция для продакшена.
 * Запускается в CMD Dockerfile ДО старта сервера.
 * Использует ALTER TABLE IF NOT EXISTS — безопасно для повторных запусков.
 */
import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

const migrations = [
  // === listings ===
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS item_category text`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS max_protection_limit numeric(12,2)`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS requires_manual_verification boolean NOT NULL DEFAULT false`,

  // === users ===
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_deals_count integer NOT NULL DEFAULT 0`,

  // === bookings ===
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS claim_status text`,
];

for (const sql of migrations) {
  try {
    await client.query(sql);
    console.log(`[migrate] OK: ${sql.slice(0, 80)}`);
  } catch (err) {
    console.error(`[migrate] ERROR: ${err.message}`);
    process.exit(1);
  }
}

await client.end();
console.log("[migrate] All migrations applied successfully");
