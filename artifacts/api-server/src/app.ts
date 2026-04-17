import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; // Добавили импорт
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import routes from "./routes";

const app: Express = express();

// 1. Доверие к прокси Amvera
app.set('trust proxy', 1);

// 2. Настройка CORS для кук
app.use(cors({
  origin: true, // Разрешаем любой origin или укажи свой домен Amvera
  credentials: true // КРИТИЧНО для работы с куками
}));

// 3. Чтение кук (ДО РОУТОВ!)
app.use(cookieParser()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  })
);

// Все твои API роуты
app.use("/api", routes);

export default app;