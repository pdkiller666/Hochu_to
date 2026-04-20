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

export type ItemCategory = "electronics" | "tools" | "leisure" | "special_machinery";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  electronics: "Электроника",
  tools: "Инструменты",
  leisure: "Отдых и спорт",
  special_machinery: "Спецтехника",
};

/** Средние цены аренды по категориям — для детектора аномалий */
export const CATEGORY_AVG_PRICE: Record<ItemCategory, number> = {
  electronics: 2500,
  tools: 1000,
  leisure: 500,
  special_machinery: 5000,
};

/**
 * Множители для расчёта лимита выплаты из фонда.
 * Уменьшены относительно старых значений — балансируют риски платформы.
 */
const CATEGORY_MULTIPLIERS: Record<ItemCategory, number> = {
  electronics: 50,
  tools: 20,
  leisure: 15,
  special_machinery: 10,
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
  const multiplier = CATEGORY_MULTIPLIERS[itemCategory] ?? 20;
  const raw = pricePerDay * multiplier;
  if (completedDealsCount < 3) {
    return Math.min(raw, 25_000);
  }
  return raw;
}

/**
 * Shield Fee (страховой сбор) — платит АРЕНДАТОР сверх стоимости аренды.
 * Формула: max(rent × 5%, 100 ₽).
 * Идёт в защитный пул платформы.
 */
export function calcShieldFee(rent: number): number {
  return Math.max(parseFloat((rent * 0.05).toFixed(2)), 100);
}

/**
 * Risk Coverage (страховое покрытие) — удерживается из выплаты ВЛАДЕЛЬЦУ.
 * Формула: max(rent × 5%, 100 ₽).
 * Зеркальный сбор — платформа берёт с обеих сторон.
 */
export function calcRiskCoverage(rent: number): number {
  return Math.max(parseFloat((rent * 0.05).toFixed(2)), 100);
}

/**
 * Залог арендатора (возвратный).
 * Math.max(1 500, pricePerDay × 2) — небольшой, чтобы не отпугивать.
 */
export function calcDeposit(pricePerDay: number): number {
  return Math.max(1500, pricePerDay * 2);
}

// ─── Итоговый расчёт стоимости бронирования ─────────────────────────────────

export interface PriceBreakdown {
  rent: number;
  /** Страховой сбор Shield — добавляется к сумме арендатора (5% мин 100₽) */
  shieldFee: number;
  /** Сервисная комиссия — скрытая, удерживается из выплаты владельцу (10%) */
  serviceFee: number;
  /** Налоговая компенсация — скрытая, удерживается из выплаты владельцу (6%) */
  taxFee: number;
  /** Страховое покрытие — скрытое, удерживается из выплаты владельцу (5% мин 100₽) */
  riskCoverage: number;
  /** Сумма к оплате арендатором (без залога) = rent + shieldFee */
  total: number;
  /** Выплата владельцу = rent - serviceFee - taxFee - riskCoverage */
  ownerPayout: number;
  /** Лимит защиты из фонда (скрытый от пользователей) */
  maxProtectionLimit: number;
  /** Залог (возвратный) */
  deposit: number;
  /** @deprecated Для обратной совместимости = shieldFee */
  fundContribution: number;
  /** @deprecated Для обратной совместимости = 0 */
  renterFundContribution: number;
  /** @deprecated Для обратной совместимости = shieldFee */
  combinedServiceFee: number;
}

export function calculateTotalPrice(
  pricePerDay: number,
  itemCategory: ItemCategory | null | undefined,
  days: number,
  ownerProtectionEnabled = true,
  _renterProtectionEnabled = false,
  completedDealsCount = 0,
): PriceBreakdown {
  const rent = pricePerDay * days;
  const cat = (itemCategory ?? "tools") as ItemCategory;

  const serviceFee = parseFloat((rent * 0.10).toFixed(2));
  const taxFee = parseFloat((rent * 0.06).toFixed(2));

  const shieldFee = ownerProtectionEnabled ? calcShieldFee(rent) : 0;
  const riskCoverage = ownerProtectionEnabled ? calcRiskCoverage(rent) : 0;

  const maxProtectionLimit = calcMaxProtectionLimit(pricePerDay, cat, completedDealsCount);

  const total = parseFloat((rent + shieldFee).toFixed(2));
  const ownerPayout = parseFloat((rent - serviceFee - taxFee - riskCoverage).toFixed(2));
  const deposit = calcDeposit(pricePerDay);

  return {
    rent,
    shieldFee,
    serviceFee,
    taxFee,
    riskCoverage,
    total,
    ownerPayout,
    maxProtectionLimit,
    deposit,
    // Обратная совместимость
    fundContribution: shieldFee,
    renterFundContribution: 0,
    combinedServiceFee: shieldFee,
  };
}
