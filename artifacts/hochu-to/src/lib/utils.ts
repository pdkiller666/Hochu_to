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
  /** Единая доля фонда: max(rent×5%, 100). Для информации в UI */
  fundShare: number;
  /** Взнос АРЕНДАТОРА в Гарантийный фонд (0 если не опт-инул) */
  renterFundContrib: number;
  /** Взнос ВЛАДЕЛЬЦА в Гарантийный фонд (0 если Free-объявление) */
  ownerFundContrib: number;
  /** Сервисная комиссия (10% от rent). С кого берётся — зависит от типа объявления */
  serviceFee: number;
  /** Налоговая компенсация (6% от rent). С кого берётся — зависит от типа объявления */
  taxFee: number;
  /** Сумма к оплате арендатором (без залога) */
  total: number;
  /** Выплата владельцу */
  ownerPayout: number;
  /** TRUE = Free-объявление + арендатор выбрал защиту (Variant 3 — арендатор платит за всё) */
  isFreeUpgrade: boolean;
  /** Лимит защиты из фонда */
  maxProtectionLimit: number;
  /** Залог (возвратный) */
  deposit: number;
  /** @deprecated Алиас renterFundContrib — для старых тултипов владельца */
  shieldFee: number;
  /** @deprecated Алиас ownerFundContrib — для старых тултипов */
  riskCoverage: number;
  /** @deprecated Для обратной совместимости */
  fundContribution: number;
  /** @deprecated Для обратной совместимости */
  renterFundContribution: number;
  /** @deprecated Для обратной совместимости */
  combinedServiceFee: number;
}

/**
 * Модель А: Один Гарантийный фонд, две независимые подписки.
 * Владелец и арендатор каждый сам решает — участвовать в фонде или нет.
 *
 * Edge case (Variant 3): Free-объявление + арендатор хочет защиту →
 * владелец получает 100% rent, арендатор оплачивает service + tax + свою долю фонда.
 */
export function calculateTotalPrice(
  pricePerDay: number,
  itemCategory: ItemCategory | null | undefined,
  days: number,
  ownerProtectionEnabled = true,
  renterFundEnabled = true,
  completedDealsCount = 0,
  rates?: FeeRates,
): PriceBreakdown {
  const rent = pricePerDay * days;
  const cat = (itemCategory ?? "tools") as ItemCategory;

  const servicePct = rateNum(rates, "serviceFeePercent");
  const taxPct = rateNum(rates, "taxFeePercent");

  // Единая формула доли фонда — одинакова для обеих сторон
  const fundShare = calcShieldFee(rent, rates); // max(rent×5%, 100)

  const ownerFundContrib = ownerProtectionEnabled ? fundShare : 0;
  const renterFundContrib = renterFundEnabled ? fundShare : 0;

  const serviceFeeAmt = parseFloat((rent * servicePct / 100).toFixed(2));
  const taxFeeAmt = parseFloat((rent * taxPct / 100).toFixed(2));

  const isFreeUpgrade = !ownerProtectionEnabled && renterFundEnabled;

  let serviceFee: number;
  let taxFee: number;
  let total: number;
  let ownerPayout: number;

  if (isFreeUpgrade) {
    // Variant 3: Free + арендатор апгрейдит → арендатор платит за всё
    serviceFee = serviceFeeAmt;
    taxFee = taxFeeAmt;
    total = parseFloat((rent + serviceFee + taxFee + renterFundContrib).toFixed(2));
    ownerPayout = rent;
  } else if (ownerProtectionEnabled) {
    // Premium: service/tax удерживаются с владельца
    serviceFee = serviceFeeAmt;
    taxFee = taxFeeAmt;
    total = parseFloat((rent + renterFundContrib).toFixed(2));
    ownerPayout = parseFloat((rent - serviceFee - taxFee - ownerFundContrib).toFixed(2));
  } else {
    // Free + арендатор не хочет защиту → этот сценарий идёт через CONTACT_FEE-ветку
    // на бэке. Возвращаем «голый» rent для превью на витрине владельца.
    serviceFee = 0;
    taxFee = 0;
    total = rent;
    ownerPayout = rent;
  }

  const maxProtectionLimit = (ownerProtectionEnabled || renterFundEnabled)
    ? calcMaxProtectionLimit(pricePerDay, cat, completedDealsCount, rates)
    : 0;

  const deposit = calcDeposit(pricePerDay, rates);

  return {
    rent,
    fundShare,
    renterFundContrib,
    ownerFundContrib,
    serviceFee,
    taxFee,
    total,
    ownerPayout,
    isFreeUpgrade,
    maxProtectionLimit,
    deposit,
    // Обратная совместимость со старыми компонентами
    shieldFee: renterFundContrib,
    riskCoverage: ownerFundContrib,
    fundContribution: ownerFundContrib,
    renterFundContribution: renterFundContrib,
    combinedServiceFee: renterFundContrib,
  };
}
