export interface SmsProvider {
  readonly name: string;
  send(phone: string, message: string): Promise<{ ok: boolean; messageId?: string; error?: string }>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

export type SmsProviderKey = "mts_exolve" | "smsc" | "stream_telecom";

export interface SmsProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  senderName?: string;
  apiUrl?: string;
}
