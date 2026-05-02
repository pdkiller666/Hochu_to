import type { SmsProvider, SmsProviderConfig } from "./types.js";

const BASE = "https://smsc.ru/sys";

export class SmscProvider implements SmsProvider {
  readonly name = "SMSC.ru";
  private login: string;
  private password: string;
  private sender: string;

  constructor(cfg: SmsProviderConfig) {
    this.login = cfg.apiKey?.trim() ?? "";
    this.password = cfg.apiSecret?.trim() ?? "";
    this.sender = cfg.senderName?.trim() || "HochuTo";
  }

  private qs(extra: Record<string, string>) {
    const p = new URLSearchParams({
      login: this.login,
      psw: this.password,
      fmt: "3",
      charset: "utf-8",
      sender: this.sender,
      ...extra,
    });
    return p.toString();
  }

  async send(phone: string, message: string) {
    const normalized = phone.replace(/\D/g, "");
    try {
      const url = `${BASE}/send.php?${this.qs({ phones: normalized, mes: message })}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const data: any = await res.json().catch(() => ({}));
      if (data?.error) return { ok: false, error: `SMSC error ${data.error_code}: ${data.error}` };
      return { ok: true, messageId: String(data?.id ?? "") };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }

  async testConnection() {
    if (!this.login || !this.password) return { ok: false, error: "Login/password not set" };
    try {
      const url = `${BASE}/balance.php?${this.qs({})}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const data: any = await res.json().catch(() => ({}));
      if (data?.error) return { ok: false, error: `${data.error}` };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Network error" };
    }
  }
}
