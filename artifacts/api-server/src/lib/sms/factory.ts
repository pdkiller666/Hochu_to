import type { SmsProvider, SmsProviderKey, SmsProviderConfig } from "./types.js";
import { MtsExolveProvider } from "./mts-exolve.js";
import { SmscProvider } from "./smsc.js";
import { StreamTelecomProvider } from "./stream-telecom.js";

let _instance: SmsProvider | null = null;
let _activeKey: SmsProviderKey | null = null;

export function createSmsProvider(key: SmsProviderKey, cfg: SmsProviderConfig): SmsProvider {
  switch (key) {
    case "mts_exolve": return new MtsExolveProvider(cfg);
    case "smsc":       return new SmscProvider(cfg);
    case "stream_telecom": return new StreamTelecomProvider(cfg);
    default:
      throw new Error(`Unknown SMS provider: ${key}`);
  }
}

export function initSmsProvider(key: SmsProviderKey, cfg: SmsProviderConfig): SmsProvider {
  _instance = createSmsProvider(key, cfg);
  _activeKey = key;
  return _instance;
}

/** Hot-swap: заменяет текущий инстанс без перезапуска сервера */
export function hotSwapSmsProvider(key: SmsProviderKey, cfg: SmsProviderConfig): SmsProvider {
  _instance = createSmsProvider(key, cfg);
  _activeKey = key;
  return _instance;
}

export function getSmsProvider(): SmsProvider | null {
  return _instance;
}

export function getActiveSmsKey(): SmsProviderKey | null {
  return _activeKey;
}

export const PROVIDER_LABELS: Record<SmsProviderKey, string> = {
  mts_exolve:    "MTS Exolve",
  smsc:          "SMSC.ru",
  stream_telecom:"Stream Telecom",
};

export const PROVIDER_FIELDS: Record<SmsProviderKey, Array<{ key: keyof SmsProviderConfig; label: string; placeholder: string; secret?: boolean }>> = {
  mts_exolve: [
    { key: "apiKey",     label: "Bearer-токен",  placeholder: "ey…",             secret: true },
    { key: "senderName", label: "Имя отправителя", placeholder: "HochuTo" },
    { key: "apiUrl",     label: "Endpoint (необязательно)", placeholder: "https://gateway.api.mts.ru/api/v1/sms/send" },
  ],
  smsc: [
    { key: "apiKey",     label: "Логин SMSC",    placeholder: "my_login" },
    { key: "apiSecret",  label: "Пароль SMSC",   placeholder: "••••••",          secret: true },
    { key: "senderName", label: "Имя отправителя", placeholder: "HochuTo" },
  ],
  stream_telecom: [
    { key: "apiKey",     label: "Логин",         placeholder: "my_login" },
    { key: "apiSecret",  label: "Пароль",        placeholder: "••••••",          secret: true },
    { key: "senderName", label: "Имя отправителя", placeholder: "HochuTo" },
    { key: "apiUrl",     label: "Endpoint (необязательно)", placeholder: "https://gateway.api.sc/api/v2/send" },
  ],
};
