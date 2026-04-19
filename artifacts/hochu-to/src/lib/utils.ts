import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

// ─── Категории защитного фонда ───────────────────────────────────────────────

export type ItemCategory = "electronics" | "tools" | "leisure";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  electronics: "Электроника",
  tools: "Инструменты",
  leisure: "Отдых и спорт",
};

/** Средние цены аренды по категориям — для детектора аномалий */
export const CATEGORY_AVG_PRICE: Record<ItemCategory, number> = {
  electronics: 2500,
  tools: 1000,
  leisure: 500,
};

/** Множители для расчёта лимита выплаты из фонда */
const CATEGORY_MULTIPLIERS: Record<ItemCategory, number> = {
  electronics: 60,
  tools: 30,
  leisure: 15,
};

/**
 * Максимальный лимит компенсации из Гарантийного фонда.
 * При < 3 завершённых сделок — жёсткий кап 25 000 ₽ (защита от фрода).
 */
export function calcMaxProtectionLimit(
  pricePerDay: number,
  itemCategory: ItemCategory,
  completedDealsCount = 0,
): number {
  const multiplier = CATEGORY_MULTIPLIERS[itemCategory];
  const raw = pricePerDay * multiplier;
  if (completedDealsCount < 3) {
    return Math.min(raw, 25_000);
  }
  return raw;
}

/**
 * Взнос в Гарантийный фонд за 1 сутки.
 * Формула: maxProtectionLimit * 0.5%, минимум 99 ₽.
 */
export function calcFundContribution(maxProtectionLimit: number): number {
  return Math.max(parseFloat((maxProtectionLimit * 0.005).toFixed(2)), 99);
}

/**
 * Залог арендатора: Math.max(1500, pricePerDay * 2).
 * Небольшой, чтобы не отпугивать арендаторов.
 */
export function calcDeposit(pricePerDay: number): number {
  return Math.max(1500, pricePerDay * 2);
}

// ─── Итоговый расчёт стоимости бронирования ─────────────────────────────────

export interface PriceBreakdown {
  rent: number;
  serviceFee: number;
  taxFee: number;
  fundContribution: number;
  renterFundContribution: number;
  /** Сервисная комиссия + налог СЗ + взнос владельца в фонд (одной строкой для арендатора) */
  combinedServiceFee: number;
  maxProtectionLimit: number;
  total: number;
  deposit: number;
}

export function calculateTotalPrice(
  pricePerDay: number,
  itemCategory: ItemCategory | null | undefined,
  days: number,
  ownerProtectionEnabled = true,
  renterProtectionEnabled = false,
  completedDealsCount = 0,
): PriceBreakdown {
  const rent = pricePerDay * days;
  const serviceFee = parseFloat((rent * 0.10).toFixed(2));
  const taxFee = parseFloat((rent * 0.06).toFixed(2));

  const cat = itemCategory ?? "tools";
  const maxProt = calcMaxProtectionLimit(pricePerDay, cat, completedDealsCount);
  const perDayFund = calcFundContribution(maxProt);

  const fundContribution = ownerProtectionEnabled ? parseFloat((perDayFund * days).toFixed(2)) : 0;
  const renterFundContribution = renterProtectionEnabled ? parseFloat((perDayFund * days).toFixed(2)) : 0;

  const combinedServiceFee = parseFloat((serviceFee + taxFee + fundContribution).toFixed(2));
  const total = parseFloat((rent + combinedServiceFee + renterFundContribution).toFixed(2));
  const deposit = calcDeposit(pricePerDay);

  return {
    rent,
    serviceFee,
    taxFee,
    fundContribution,
    renterFundContribution,
    combinedServiceFee,
    maxProtectionLimit: maxProt,
    total,
    deposit,
  };
}
