import type { SmsProvider, SmsProviderConfig } from "./types.js";

const DEFAULT_ENDPOINT = "https://gateway.api.sc/api/v2/send";

export class StreamTelecomProvider implements SmsProvider {
  readonly name = "Stream Telecom";
  private login: string;
  private password: string;
  private sender: string;
  private endpoint: string;

  constructor(cfg: SmsProviderConfig) {
    this.login = cfg.apiKey?.trim() ?? "";
    this.password = cfg.apiSecret?.trim() ?? "";
    this.sender = cfg.senderName?.trim() || "HochuTo";
    this.endpoint = cfg.apiUrl?.trim() || DEFAULT_ENDPOINT;
  }

  async send(phone: string, message: string) {
    const normalized = phone.replace(/\D/g, "");
    const msisdn = normalized.startsWith("7") ? normalized : `7${normalized}`;
    const credentials = Buffer.from(`${this.login}:${this.password}`).toString("base64");
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
          messages: [{ recipient: msisdn, text: message }],
          originator: this.sender,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status === "error") {
        return { ok: false, error: data?.description ?? `HTTP ${res.status}` };
      }
      return { ok: true, messageId: String(data?.messages?.[0]?.id ?? "") };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }

  async testConnection() {
    if (!this.login || !this.password) return { ok: false, error: "Login/password not set" };
    const credentials = Buffer.from(`${this.login}:${this.password}`).toString("base64");
    try {
      const res = await fetch("https://gateway.api.sc/api/v2/balance", {
        headers: { "Authorization": `Basic ${credentials}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }
}
