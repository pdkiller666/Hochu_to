import { createHash, randomBytes } from "node:crypto";

const REFRESH_TOKEN_TTL_DAYS = 30;

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function getRefreshExpiresAt(): Date {
  const now = Date.now();
  const ttlMs = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  return new Date(now + ttlMs);
}

export const REFRESH_TOKEN_COOKIE = "ht_refresh_token";
