import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; 
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import routes from "./routes";

// Восстанавливаем работу с путями для ESM (как было в твоем оригинале)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// 1. КРИТИЧНО: Доверие к прокси Amvera для работы сессий через HTTPS
app.set('trust proxy', 1);

// 2. ИСПРАВЛЕНО: Настройка CORS (credentials: true обязателен для кук)
app.use(cors({
  origin: true, 
  credentials: true 
}));

// 3. НОВОЕ: Чтение кук (без этого refresh-token не будет виден серверу)
app.use(cookieParser()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Твой оригинальный логгер pino
app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  })
);

// Твои API роуты
app.use("/api", routes);

/**
 * РАЗДАЧА ФРОНТЕНДА
 * Исправляем ошибку "Cannot GET /auth", которая возникла из-за опечаток в путях
 */
if (process.env.NODE_ENV === "production") {
  // Путь к папке со статикой (убедись, что после сборки папка называется public)
  const staticDir = path.resolve(__dirname, "public");
  
  app.use(express.static(staticDir));

  // Исправленный "Catch-all" роут для SPA. 
  // Любой путь (кроме /api) будет отдавать index.html
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found", message: "API endpoint not found" });
    }
    
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        // Если файла нет, выводим понятную ошибку вместо "Cannot GET"
        res.status(500).send("index.html not found in public directory. Check build process.");
      }
    });
  });
}

export default app;