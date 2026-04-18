import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import routes from "./routes";

// Настройка для работы с путями в ES-модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

/**
 * 1. ДОВЕРИЕ К ПРОКСИ (ДЛЯ AMVERA)
 */
app.set('trust proxy', 1);

/**
 * 2. НАСТРОЙКА CORS
 */
app.use(cors({
  origin: true, 
  credentials: true 
}));

/**
 * 3. ПОДКЛЮЧЕНИЕ COOKIE PARSER
 */
app.use(cookieParser()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 4. ЛОГГИРОВАНИЕ
 */
app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  })
);

/**
 * 5. API РОУТЫ
 */
app.use("/api", routes);

/**
 * 6. РАЗДАЧА ФРОНТЕНДА (ДЛЯ ПРОДАКШЕНА)
 */
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "public");
  
  // Раздаем статические файлы (js, css, картинки)
  app.use(express.static(staticDir));

  /**
   * ИСПРАВЛЕНИЕ ДЛЯ EXPRESS 5:
   * Вместо "*" используем "/:path*", чтобы избежать ошибки "Missing parameter name".
   */
  app.get("/:path*", (req, res) => {
    // Если это запрос к API, который не нашелся выше — отдаем 404
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ 
        error: "not_found", 
        message: "API endpoint not found" 
      });
    }
    
    // Все остальные запросы (навигация фронтенда) отправляем в index.html
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        res.status(500).send("index.html not found in public folder. Check build production.");
      }
    });
  });
}

export default app;