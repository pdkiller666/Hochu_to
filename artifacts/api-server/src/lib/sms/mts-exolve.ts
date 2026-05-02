import type { SmsProvider, SmsProviderConfig } from "./types.js";

const DEFAULT_ENDPOINT = "https://gateway.api.mts.ru/api/v1/sms/send";

export class MtsExolveProvider implements SmsProvider {
  readonly name = "MTS Exolve";
  private apiKey: string;
  private sender: string;
  private endpoint: string;

  constructor(cfg: SmsProviderConfig) {
    this.apiKey = cfg.apiKey?.trim() ?? "";
    this.sender = cfg.senderName?.trim() || "HochuTo";
    this.endpoint = cfg.apiUrl?.trim() || DEFAULT_ENDPOINT;
  }

  async send(phone: string, message: string) {
    const normalized = phone.replace(/\D/g, "");
    const e164 = normalized.startsWith("7") ? `+${normalized}` : `+7${normalized}`;
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          message: { sms: { text: message } },
          recipients: [{ msisdn: e164 }],
          originator: { sms: { originatorId: this.sender } },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error_message ?? `HTTP ${res.status}` };
      }
      const msgId = data?.recipients?.[0]?.messageId ?? data?.messageId;
      return { ok: true, messageId: String(msgId ?? "") };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }

  async testConnection() {
    if (!this.apiKey) return { ok: false, error: "API key not set" };
    try {
      const res = await fetch("https://gateway.api.mts.ru/api/v1/balances", {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }
}
