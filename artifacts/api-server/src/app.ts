import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import routes from "./routes";
import { UPLOADS_DIR } from "./lib/uploadsDir.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// 1. Доверие к прокси Amvera (для HTTPS и кук)
app.set('trust proxy', 1);

// 2. CORS — allowlist конкретных доменов в prod, dev отражает origin
const ALLOWED_ORIGINS = [
  "https://hocuto-pdkiller666.amvera.io",
  "http://localhost:5000",
  "http://localhost:3000",
];
app.use(cors({
  origin: (origin, cb) => {
    // Запросы без Origin (curl, мобильные app, server-to-server) — пропускаем
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // В dev-режиме разрешаем всё (Replit preview, localhost произвольный порт)
    if (process.env.NODE_ENV !== "production") return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// 3. Чтение кук ПЕРЕД роутами
app.use(cookieParser());

// 4. JSON body с лимитом 500kb (защита от memory exhaustion)
app.use(express.json({
  limit: "500kb",
  // Stage 21a: сохраняем raw body для верификации подписи ЮKassa-вебхуков
  verify: (req: any, _res, buf: Buffer) => {
    if (buf && buf.length) req.rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));

// 5. Логгер pino
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => (err || (res.statusCode ?? 0) >= 500 ? "error" : "info"),
  })
);

// 6. Раздача загруженных файлов
app.use("/uploads", express.static(UPLOADS_DIR));

// 7. API РОУТЫ
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});
app.use("/api", routes);

// 8. JSON 404 для всех неизвестных /api/*
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found", message: "API endpoint not found" });
});

// 9. РАЗДАЧА ФРОНТЕНДА
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "public");
  app.use(express.static(staticDir));
  app.get("/{*wildcard}", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "not_found", message: "API endpoint not found" });
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) res.status(500).send("index.html not found. Check build folders.");
    });
  });
}

// 10. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК — должен быть последним
// Ловит любые ошибки из async-роутов (Express 5 передаёт их сюда автоматически)
// и возвращает JSON вместо краша сервера.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Внутренняя ошибка сервера"
      : (err?.message ?? "Unknown error");

  logger.error({ err: err?.message, stack: err?.stack, status }, "global error handler");

  if (!res.headersSent) {
    res.status(status).json({
      error: err?.code ?? "internal_error",
      message,
    });
  }
});

export default app;
