import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "./logger.js";
import { getPlatformSettings } from "./platform-settings.js";

/**
 * Минимальный REST-клиент ЮKassa (Stage 21a).
 * Документация: https://yookassa.ru/developers/api
 *
 * Аутентификация: Basic base64(`shopId:secretKey`).
 * Для всех POST-запросов обязателен заголовок `Idempotence-Key` (UUID).
 *
 * Источники реквизитов:
 *  1) ENV `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` — приоритет (для продакшна).
 *  2) `platform_settings.yookassaShopId / yookassaSecretKey` — фолбэк (для админ-UI).
 */

const API_BASE = "https://api.yookassa.ru/v3";

export interface YooKassaCredentials {
  shopId: string;
  secretKey: string;
  testMode: boolean;
}

export class YooKassaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YooKassaConfigError";
  }
}

export class YooKassaApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "YooKassaApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Возвращает реквизиты ЮKassa или бросает YooKassaConfigError, если они не настроены.
 */
export async function getYooKassaCredentials(): Promise<YooKassaCredentials> {
  const envShopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const envSecret = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (envShopId && envSecret) {
    return { shopId: envShopId, secretKey: envSecret, testMode: envSecret.startsWith("test_") };
  }
  const s = await getPlatformSettings();
  if (s.yookassaShopId && s.yookassaSecretKey) {
    return {
      shopId: s.yookassaShopId,
      secretKey: s.yookassaSecretKey,
      testMode: s.yookassaTestMode,
    };
  }
  throw new YooKassaConfigError(
    "ЮKassa не настроена: укажите YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY в env или в админке (Платежи → ЮKassa).",
  );
}

function authHeader(creds: YooKassaCredentials): string {
  return "Basic " + Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString("base64");
}

async function ykFetch<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  idempotenceKey: string | null,
): Promise<T> {
  const creds = await getYooKassaCredentials();
  const headers: Record<string, string> = {
    Authorization: authHeader(creds),
    "Content-Type": "application/json",
  };
  if (idempotenceKey) headers["Idempotence-Key"] = idempotenceKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    logger.error({ status: res.status, body: parsed, path }, "YooKassa API error");
    throw new YooKassaApiError(
      parsed?.description || parsed?.error || `YooKassa ${res.status}`,
      res.status,
      parsed,
    );
  }
  return parsed as T;
}

export interface CreatePaymentArgs {
  /** Сумма в рублях (integer ₽). Внутри переводим в `value: "X.XX"`. */
  amountRub: number;
  description: string;
  returnUrl: string;
  /**
   * false → двухэтапный платёж: списание удерживается (hold), `capture` подтверждает.
   * Для бронирований с защитой используем capture:false (холд на время аренды).
   * true (по умолчанию) → одноэтапный.
   */
  capture?: boolean;
  /** Произвольные метаданные, вернутся в webhook (target_type, target_id и т.п.). */
  metadata?: Record<string, any>;
  /** Если не передан — генерируется UUID. Возвращается в результате. */
  idempotencyKey?: string;
  /** Email/телефон плательщика для чека (опционально). */
  customer?: { email?: string; phone?: string };
}

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  paid?: boolean;
  captured_at?: string;
  metadata?: Record<string, any>;
  description?: string;
}

export interface CreatePaymentResult {
  payment: YooKassaPayment;
  idempotencyKey: string;
  confirmationUrl: string | null;
}

export async function createPayment(args: CreatePaymentArgs): Promise<CreatePaymentResult> {
  const idempotencyKey = args.idempotencyKey ?? randomUUID();
  const body: any = {
    amount: { value: args.amountRub.toFixed(2), currency: "RUB" },
    capture: args.capture ?? true,
    confirmation: { type: "redirect", return_url: args.returnUrl },
    description: args.description,
  };
  if (args.metadata) body.metadata = args.metadata;
  if (args.customer) {
    body.receipt = {
      customer: args.customer,
      items: [{
        description: args.description.slice(0, 128),
        quantity: "1.00",
        amount: { value: args.amountRub.toFixed(2), currency: "RUB" },
        vat_code: 1,
        payment_subject: "service",
        payment_mode: "full_payment",
      }],
    };
  }

  const payment = await ykFetch<YooKassaPayment>("POST", "/payments", body, idempotencyKey);
  return {
    payment,
    idempotencyKey,
    confirmationUrl: payment.confirmation?.confirmation_url ?? null,
  };
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  return ykFetch<YooKassaPayment>("GET", `/payments/${paymentId}`, null, null);
}

export async function capturePayment(paymentId: string, amountRub: number, idempotencyKey?: string): Promise<YooKassaPayment> {
  const key = idempotencyKey ?? randomUUID();
  return ykFetch<YooKassaPayment>("POST", `/payments/${paymentId}/capture`, {
    amount: { value: amountRub.toFixed(2), currency: "RUB" },
  }, key);
}

export async function cancelPayment(paymentId: string, idempotencyKey?: string): Promise<YooKassaPayment> {
  const key = idempotencyKey ?? randomUUID();
  return ykFetch<YooKassaPayment>("POST", `/payments/${paymentId}/cancel`, {}, key);
}

/**
 * Проверка подписи webhook-уведомления через HMAC-SHA256(rawBody, secret).
 *
 * Источник секрета: env `YOOKASSA_WEBHOOK_SECRET`.
 * Если секрет не задан — в dev-режиме (NODE_ENV !== "production") доверяем,
 * в production отказываем (fail-closed), чтобы исключить replay-атаки.
 *
 * Сверка через timingSafeEqual защищает от timing-атак.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.YOOKASSA_WEBHOOK_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (!secret) {
    if (isProd) {
      logger.error("YOOKASSA_WEBHOOK_SECRET не задан в production — webhook отклонён");
      return false;
    }
    return true; // dev: принимаем для удобства локального тестирования
  }
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Поддерживаем формат `sha256=<hex>` и просто `<hex>`
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}
