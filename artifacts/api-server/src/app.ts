import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import routes from "./routes";

// Настройка путей для ES-модулей (необходима, так как в package.json type: module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

/**
 * 1. ДОВЕРИЕ К ПРОКСИ
 * Критично для Amvera, чтобы сервер понимал, что запросы идут через HTTPS
 */
app.set('trust proxy', 1);

/**
 * 2. НАСТРОЙКА CORS
 * credentials: true позволяет браузеру сохранять и передавать куки (Refresh Token)
 */
app.use(cors({
  origin: true, 
  credentials: true 
}));

/**
 * 3. ЧТЕНИЕ КУК
 * ПодключаемcookieParser ПЕРЕД роутами, чтобы бэкенд видел Refresh Token
 */
app.use(cookieParser()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 4. ЛОГГИРОВАНИЕ (Твой оригинальный pino-http)
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
 * 6. РАЗДАЧА ФРОНТЕНДА (Static Files)
 * Настройка для продакшена в облаке Amvera
 */
if (process.env.NODE_ENV === "production") {
  // Убедись, что фронтенд после сборки попадает именно в папку public
  const staticDir = path.resolve(__dirname, "public");
  
  app.use(express.static(staticDir));

  /**
   * ИСПРАВЛЕНИЕ ДЛЯ EXPRESS 5.0:
   * В 5-й версии нельзя использовать просто "*", так как это вызывает PathError.
   * Используем "/*" — это корректный catch-all роут для SPA.
   */
  app.get("/*", (req, res) => {
    // Если запрос пришел на несуществующий API-эндпоинт, отдаем 404 в JSON
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ 
        error: "not_found", 
        message: "API endpoint not found" 
      });
    }
    
    // Все остальные запросы (на роуты фронтенда типа /auth) перенаправляем на index.html
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        // Если index.html не найден, значит сборка фронтенда не попала в папку public
        res.status(500).send("index.html not found. Check if the frontend build is in the 'public' folder.");
      }
    });
  });
}

export default app;