import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Только изображения"));
  },
});

router.post("/upload", requireAuth, upload.array("photos", 10), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "Нет файлов" });
    return;
  }
  const urls = files.map(f => `/uploads/${f.filename}`);
  res.json({ urls });
});

export default router;
