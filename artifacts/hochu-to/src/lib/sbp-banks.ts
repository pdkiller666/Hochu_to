/**
 * Frontend-копия списка банков СБП. Должна совпадать с
 * `artifacts/api-server/src/lib/sbp-banks.ts` (один источник правды — `id`).
 * При изменениях обновлять оба файла.
 */

export type SbpBank = { id: string; name: string };

export const SBP_BANKS: readonly SbpBank[] = [
  { id: "tbank", name: "Т-Банк (Тинькофф)" },
  { id: "sber", name: "Сбербанк" },
  { id: "vtb", name: "ВТБ" },
  { id: "alfa", name: "Альфа-Банк" },
  { id: "raiffeisen", name: "Райффайзенбанк" },
  { id: "gazprombank", name: "Газпромбанк" },
  { id: "otkritie", name: "Открытие" },
  { id: "rshb", name: "Россельхозбанк" },
  { id: "sovcombank", name: "Совкомбанк" },
  { id: "bspb", name: "Банк Санкт-Петербург" },
  { id: "mkb", name: "МКБ" },
  { id: "psb", name: "Промсвязьбанк" },
  { id: "tochka", name: "Точка Банк" },
  { id: "ozon", name: "Озон Банк" },
  { id: "yoomoney", name: "ЮMoney" },
  { id: "homecredit", name: "Хоум Банк" },
  { id: "uralsib", name: "Уралсиб" },
  { id: "rosbank", name: "РОСБАНК" },
  { id: "renessans", name: "Ренессанс" },
  { id: "otp", name: "ОТП Банк" },
  { id: "pochtabank", name: "Почта Банк" },
  { id: "absolut", name: "Абсолют Банк" },
  { id: "rsb", name: "Русский Стандарт" },
  { id: "akbars", name: "Ак Барс" },
  { id: "other", name: "Другой банк (укажите в комментарии)" },
] as const;

export function getSbpBankName(id: string | null | undefined): string {
  if (!id) return "Банк не указан";
  return SBP_BANKS.find(b => b.id === id)?.name ?? id;
}

/**
 * Маска ввода телефона: пользователь вводит цифры, видит «+7 (XXX) XXX-XX-XX».
 * Возвращает форматированную строку для отображения в input.
 */
export function formatPhoneMask(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  let out = "+7";
  if (digits.length > 0) out += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) out += `)`;
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  return out;
}

/**
 * Извлекает чистый телефон в формате `+7XXXXXXXXXX` для отправки на бэк.
 * Возвращает null если ввод не является валидным российским мобильным.
 */
export function extractCleanPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 || !digits.startsWith("9")) return null;
  return `+7${digits}`;
}
