import { createHmac, timingSafeEqual } from "node:crypto";

interface TokenPayload {
  userId: number;
  exp: number;
  iat: number;
}

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT",
} as const;

const DEFAULT_SECRET = "change-me-in-production";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret(): string {
  return process.env["AUTH_JWT_SECRET"] ?? DEFAULT_SECRET;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(unsignedToken: string): string {
  return createHmac("sha256", getSecret()).update(unsignedToken).digest("base64url");
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function issueAccessToken(userId: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    userId,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(JWT_HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token: string): { userId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(encodedSignature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const header = safeJsonParse<{ alg?: string; typ?: string }>(base64UrlDecode(encodedHeader));
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    return null;
  }

  const payload = safeJsonParse<TokenPayload>(base64UrlDecode(encodedPayload));
  if (!payload || typeof payload.userId !== "number" || typeof payload.exp !== "number") {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  return { userId: payload.userId };
}
