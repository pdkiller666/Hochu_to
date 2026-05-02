import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { ensurePlatformSettings } from "./lib/platform-settings";
import { backfillListingCounters } from "./lib/backfill-counters";
import { initWebSocketServer } from "./lib/websocket";
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

    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, defaultEmail),
    });

    if (existingUser) {
      if (existingUser.role !== "superadmin") {
        await db.update(usersTable)
          .set({ role: "superadmin" })
          .where(eq(usersTable.email, defaultEmail));
        logger.info({ email: defaultEmail, prevRole: existingUser.role }, "Platform owner promoted to superadmin.");
      } else {
        logger.info({ email: defaultEmail }, "Platform owner (superadmin) already exists, skipping seed.");
      }
      return;
    }

    const defaultPassword = process.env["ADMIN_PASSWORD"] ?? "Admin123!";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await db.insert(usersTable).values({
      name: "Владелец платформы",
      email: defaultEmail,
      passwordHash,
      role: "superadmin",
    }).onConflictDoNothing({ target: usersTable.email });

    logger.info({ email: defaultEmail }, "Platform owner (superadmin) created. Change password after first login.");
  } catch (err) {
    logger.warn({ err }, "Non-fatal error during seedDefaultAdmin. Server will continue to start.");
  }
}

// ─── Stage 30D: AI provider env diagnostics ────────────────────────────────
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

// ─── Stage 34: HTTP server + WebSocket server ────────────────────────────────
const httpServer = createServer(app);
initWebSocketServer(httpServer);

httpServer.listen(port, "0.0.0.0", async (err?: Error) => {
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
