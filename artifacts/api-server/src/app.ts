import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import routes from "./routes";

// Настройка путей для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// 1. Доверие к прокси Amvera (для HTTPS и кук)
app.set('trust proxy', 1);

// 2. Настройка CORS (credentials: true обязателен для авторизации)
app.use(cors({
  origin: true, 
  credentials: true 
}));

// 3. Чтение кук ПЕРЕД роутами
app.use(cookieParser()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Твой логгер pino
app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  })
);

// 5. API РОУТЫ
app.use("/api", routes);

// 6. РАЗДАЧА ФРОНТЕНДА
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "public");
  
  app.use(express.static(staticDir));

  /**
   * CATCH-ALL ДЛЯ EXPRESS 5 + path-to-regexp v8:
   * Единственный валидный синтаксис: /{*wildcard}
   * Варианты /*, /:path*, /(.*)  — все вызывают PathError в новой версии.
   */
  app.get("/{*wildcard}", (req, res) => {
    // Если это запрос к API, который не отработал выше — отдаем 404
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found", message: "API endpoint not found" });
    }
    
    // Все остальное (включая /auth, /profile и т.д.) отправляем на фронтенд
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        res.status(500).send("index.html not found. Check build folders.");
      }
    });
  });
}

export default app;
