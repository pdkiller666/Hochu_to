import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";

const router = Router();

// UPLOADS_DIR гарантированно создан при импорте uploadsDir.ts

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
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
