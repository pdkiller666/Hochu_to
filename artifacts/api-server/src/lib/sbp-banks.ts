/**
 * Whitelist банков-участников СБП. Slug-id используется как стабильный ключ
 * (хранится в `payout_methods.sbp_bank`), `name` — для UI/админки.
 *
 * Stage 20b — полировка СБП-выплат. До этого `sbp_bank` принимал любой текст
 * пользователя ("сбербанг", "Sber", "т. банк"), что мешало идентификации
 * банка-получателя при ручном `mark-paid` админом.
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

const SBP_BANK_IDS: ReadonlySet<string> = new Set(SBP_BANKS.map(b => b.id));

export function isValidSbpBankId(id: unknown): id is string {
  return typeof id === "string" && SBP_BANK_IDS.has(id);
}

export function getSbpBankName(id: string | null | undefined): string {
  if (!id) return "Банк не указан";
  return SBP_BANKS.find(b => b.id === id)?.name ?? id;
}

/**
 * Нормализация телефона к каноничному `+7XXXXXXXXXX`.
 * Возвращает null, если ввод — не валидный российский мобильный.
 *
 * Принимает: `+7 (916) 123-45-67`, `89161234567`, `9161234567`, `+79161234567`.
 * Отклоняет: меньше 10 значащих цифр, не российский код, начало не на 9 (мобильный СБП).
 */
export function normalizeSbpPhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  if (!digits.startsWith("9")) return null; // СБП — только мобильные номера (+7 9XX)
  return `+7${digits}`;
}
