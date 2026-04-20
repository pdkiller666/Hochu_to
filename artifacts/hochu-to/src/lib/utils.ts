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
 * Маппинг slug основной категории каталога → внутренняя категория защитного фонда.
 * Используется автоматически — пользователь видит только основную категорию.
 */
const CATEGORY_SLUG_TO_ITEM: Record<string, ItemCategory> = {
  construction: "tools",
  tourism: "leisure",
  garden: "tools",
  holidays: "leisure",
  children: "leisure",
  electronics: "electronics",
  auto: "special_machinery",
  clothing: "leisure",
  photo: "electronics",
  books: "leisure",
};

export function mapCategorySlugToItemCategory(slug?: string | null): ItemCategory {
  if (!slug) return "tools";
  return CATEGORY_SLUG_TO_ITEM[slug] ?? "tools";
}

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
  rates?: FeeRates,
): number {
  const mults: Record<ItemCategory, number> = {
    electronics: rateNum(rates, "protMultElectronics"),
    tools: rateNum(rates, "protMultTools"),
    leisure: rateNum(rates, "protMultLeisure"),
    special_machinery: rateNum(rates, "protMultSpecialMachinery"),
  };
  const multiplier = mults[itemCategory] ?? mults.tools;
  const raw = pricePerDay * multiplier;
  const cap = rateNum(rates, "newUserProtectionCap");
  const threshold = rateNum(rates, "newUserDealsThreshold");
  if (completedDealsCount < threshold) {
    return Math.min(raw, cap);
  }
  return raw;
}

/**
 * Взнос в Гарантийный фонд — платит АРЕНДАТОР сверх стоимости аренды.
 * Формула: max(rent × 5%, 100 ₽).
 * Идёт в пул Гарантийного фонда платформы.
 */
export interface FeeRates {
  serviceFeePercent?: number;
  taxFeePercent?: number;
  shieldFeePercent?: number;
  shieldFeeMin?: number;
  riskCoveragePercent?: number;
  riskCoverageMin?: number;
  depositMultiplier?: number;
  depositMin?: number;
  protMultElectronics?: number;
  protMultTools?: number;
  protMultLeisure?: number;
  protMultSpecialMachinery?: number;
  newUserProtectionCap?: number;
  newUserDealsThreshold?: number;
}

export const DEFAULT_RATES: Required<FeeRates> = {
  serviceFeePercent: 10,
  taxFeePercent: 6,
  shieldFeePercent: 5,
  shieldFeeMin: 100,
  riskCoveragePercent: 5,
  riskCoverageMin: 100,
  depositMultiplier: 2,
  depositMin: 1500,
  protMultElectronics: 50,
  protMultTools: 20,
  protMultLeisure: 15,
  protMultSpecialMachinery: 10,
  newUserProtectionCap: 25000,
  newUserDealsThreshold: 3,
};

function rateNum(rates: FeeRates | undefined, key: keyof FeeRates): number {
  const v = rates?.[key];
  return typeof v === "number" && !isNaN(v) ? v : DEFAULT_RATES[key];
}

export function calcShieldFee(rent: number, rates?: FeeRates): number {
  const pct = rateNum(rates, "shieldFeePercent");
  const min = rateNum(rates, "shieldFeeMin");
  return Math.max(parseFloat((rent * pct / 100).toFixed(2)), min);
}

/**
 * Risk Coverage (страховое покрытие) — удерживается из выплаты ВЛАДЕЛЬЦУ.
 * Формула: max(rent × 5%, 100 ₽).
 * Зеркальный сбор — платформа берёт с обеих сторон.
 */
export function calcRiskCoverage(rent: number, rates?: FeeRates): number {
  const pct = rateNum(rates, "riskCoveragePercent");
  const min = rateNum(rates, "riskCoverageMin");
  return Math.max(parseFloat((rent * pct / 100).toFixed(2)), min);
}

/**
 * Залог арендатора (возвратный).
 * Math.max(1 500, pricePerDay × 2) — небольшой, чтобы не отпугивать.
 */
export function calcDeposit(pricePerDay: number, rates?: FeeRates): number {
  const mult = rateNum(rates, "depositMultiplier");
  const min = rateNum(rates, "depositMin");
  return Math.max(min, pricePerDay * mult);
}

// ─── Итоговый расчёт стоимости бронирования ─────────────────────────────────

export interface PriceBreakdown {
  rent: number;
  /** Взнос в Гарантийный фонд — добавляется к сумме арендатора (5% мин 100₽) */
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
  rates?: FeeRates,
): PriceBreakdown {
  const rent = pricePerDay * days;
  const cat = (itemCategory ?? "tools") as ItemCategory;

  const servicePct = rateNum(rates, "serviceFeePercent");
  const taxPct = rateNum(rates, "taxFeePercent");

  // Free тариф (Объявление): платформа НЕ удерживает ни сервисную, ни налоговую комиссию.
  // Владелец получает 100% суммы аренды лично от арендатора (как на Авито).
  const serviceFee = ownerProtectionEnabled
    ? parseFloat((rent * servicePct / 100).toFixed(2))
    : 0;
  const taxFee = ownerProtectionEnabled
    ? parseFloat((rent * taxPct / 100).toFixed(2))
    : 0;

  const shieldFee = ownerProtectionEnabled ? calcShieldFee(rent, rates) : 0;
  const rawRiskCoverage = ownerProtectionEnabled ? calcRiskCoverage(rent, rates) : 0;
  const maxRisk = Math.max(0, parseFloat((rent - serviceFee - taxFee).toFixed(2)));
  const riskCoverage = Math.min(rawRiskCoverage, maxRisk);

  const maxProtectionLimit = ownerProtectionEnabled
    ? calcMaxProtectionLimit(pricePerDay, cat, completedDealsCount, rates)
    : 0;

  const total = parseFloat((rent + shieldFee).toFixed(2));
  const ownerPayout = parseFloat((rent - serviceFee - taxFee - riskCoverage).toFixed(2));
  const deposit = calcDeposit(pricePerDay, rates);

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
