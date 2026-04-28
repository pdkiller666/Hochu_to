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
  const existingAdmin = await db.query.usersTable.findFirst({
    where: eq(usersTable.role, "admin"),
  });
  if (existingAdmin) return;

  const defaultEmail = process.env["ADMIN_EMAIL"] ?? "admin@hochu.to";
  const defaultPassword = process.env["ADMIN_PASSWORD"] ?? "Admin123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await db.insert(usersTable).values({
    name: "Администратор",
    email: defaultEmail,
    passwordHash,
    role: "admin",
  });

  logger.info({ email: defaultEmail }, "Default admin created. Change password after first login.");
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
    logger.info({ settingsId: settings.id, paymentMode: settings.paymentMode }, "Platform settings ready");
  } catch (e) {
    logger.error({ err: e }, "Failed to initialize platform settings");
  }
  try {
    await backfillListingCounters();
  } catch (e) {
    logger.error({ err: e }, "Failed to backfill listing counters");
  }
  startScheduler();
});
