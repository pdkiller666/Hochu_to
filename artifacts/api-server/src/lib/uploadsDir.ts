import path from "path";
import fs from "fs";

/**
 * Persistent uploads directory.
 *
 * In production (Amvera) files go to /data/uploads which is mapped to the
 * persistent volume declared in amvera.yml (`persistenceMount: /data`).
 * This directory survives container rebuilds and restarts.
 *
 * In development files go to <cwd>/uploads as before.
 */
export const UPLOADS_DIR =
  process.env.NODE_ENV === "production"
    ? "/data/uploads"
    : path.resolve("uploads");

// Ensure the directory exists at startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
