import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { ensurePlatformSettings } from "./lib/platform-settings";
import { backfillListingCounters } from "./lib/backfill-counters";
import { db, usersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDefaultAdmin() {
  try {
    const defaultEmail = process.env["ADMIN_EMAIL"] ?? "admin@hochu.to";
    
    // 1. Ищем строго по email, так как именно он должен быть уникальным
    const existingAdmin = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, defaultEmail),
    });
    
    if (existingAdmin) {
      logger.info({ email: defaultEmail }, "Default admin already exists, skipping seed.");
      return;
    }

    const defaultPassword = process.env["ADMIN_PASSWORD"] ?? "Admin123!";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 2. Броня базы данных: если кто-то успел вставить email, ничего не делаем
    await db.insert(usersTable).values({
      name: "Администратор",
      email: defaultEmail,
      passwordHash,
      role: "admin",
    }).onConflictDoNothing({ target: usersTable.email });

    logger.info({ email: defaultEmail }, "Default admin created. Change password after first login.");
  } catch (err) {
    // 3. Броня сервера: никогда не роняем приложение из-за сидирования
    logger.warn({ err }, "Non-fatal error during seedDefaultAdmin. Server will continue to start.");
  }
}

// ─── Stage 30D: AI provider env diagnostics ────────────────────────────────
// Печатаем только наличие и длину ключей, чтобы убедиться, что они доехали
// до контейнера. Сами ключи НИКОГДА не логируем.
console.log("--- AI CONFIG DIAGNOSTICS ---");
console.log(
  "GEMINI_KEY exists:",
  !!process.env["GEMINI_API_KEY"],
  "length:",
  process.env["GEMINI_API_KEY"]?.length ?? 0,
);
console.log(
  "AMVERA_TOKEN exists:",
  !!process.env["AMVERA_API_TOKEN"],
  "length:",
  process.env["AMVERA_API_TOKEN"]?.length ?? 0,
);
console.log("-----------------------------");

app.listen(port, "0.0.0.0", async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  
  await seedDefaultAdmin();
  
  try {
    const settings = await ensurePlatformSettings();
    logger.info({ settingsId: settings.id, paymentMode: settings.paymentMode }, "Platform settings initialized.");

    // Запуск шедулера (cron-задачи)
    startScheduler();
    logger.info("Scheduler started successfully.");

    // Stage 25b: Одноразовый пересчет счетчиков
    await backfillListingCounters();
    logger.info("Counters backfilled successfully.");
  } catch (setupErr) {
    logger.error({ err: setupErr }, "Error during application setup");
  }
});

// Очередь graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    // Если используешь pool Drizzle с Pg, можно добавить закрытие пула
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));