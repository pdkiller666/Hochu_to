/**
 * Stage 29 — одноразовая «обратная засолка» Trust Score для всех пользователей.
 *
 * Запуск:  pnpm --filter @workspace/api-server run backfill:trust
 *
 * Безопасно вызывать повторно: каждая запись в audit_events помечена
 * причиной "backfill", а пересчёт идемпотентен.
 */
import { db, usersTable } from "@workspace/db";
import { calculateAndUpdateTrustScore } from "./lib/trust-score.js";

async function main() {
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  console.log(`[backfill] найдено пользователей: ${users.length}`);

  let ok = 0;
  let failed = 0;
  for (const u of users) {
    const score = await calculateAndUpdateTrustScore(u.id, null, "backfill");
    if (score === null) {
      failed++;
      console.warn(`[backfill] #${u.id} (${u.name}) — пересчёт не удался`);
    } else {
      ok++;
      console.log(`[backfill] #${u.id} (${u.name}) → ${score}`);
    }
  }

  console.log(`\n[backfill] готово: ${ok} обновлено, ${failed} с ошибкой`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(2);
});
