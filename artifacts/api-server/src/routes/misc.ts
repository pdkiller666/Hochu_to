import { Router } from "express";
import { db, newsletterTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/newsletter/subscribe", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    res.status(400).json({ error: "validation_error", message: "Email обязателен" });
    return;
  }

  try {
    await db.insert(newsletterTable).values({ email }).onConflictDoNothing();
    res.json({ success: true, message: "Вы успешно подписались на рассылку" });
  } catch {
    res.json({ success: true, message: "Вы уже подписаны" });
  }
});

router.post("/contact", async (req, res) => {
  const { name, email, message, subject } = req.body ?? {};

  if (!name || !email || !message) {
    res.status(400).json({ error: "validation_error", message: "Заполните обязательные поля" });
    return;
  }

  // In production, this would send an email
  res.json({ success: true, message: "Ваше сообщение отправлено. Мы свяжемся с вами в ближайшее время." });
});

export default router;
