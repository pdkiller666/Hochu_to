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

export interface PriceBreakdown {
  rent: number;
  serviceFee: number;
  taxFee: number;
  ownerFundContribution: number;
  renterFundContribution: number;
  /** Комиссия сервиса объединённая: serviceFee + taxFee + ownerFundContribution */
  combinedServiceFee: number;
  fundRate: number;
  total: number;
  deposit: number;
}

/**
 * Регрессивная ставка взноса в Гарантийный фонд «Стальной щит».
 * Чем дороже вещь — тем меньше процент, чтобы аренда оставалась доступной.
 */
export function getFundRate(marketValue: number): number {
  if (marketValue <= 50_000) return 0.005;   // 0.5% — бюджетные вещи
  if (marketValue <= 150_000) return 0.002;  // 0.2% — средний сегмент
  return 0.001;                              // 0.1% — дорогие вещи
}

/**
 * Ступенчатый залог по рыночной стоимости вещи.
 * Мин. барьер снижен: мангал за 3 000 ₽ → залог 2 000 ₽, а не 5 000 ₽.
 */
export function getDeposit(marketValue: number): number {
  if (marketValue < 10_000) return 2_000;
  if (marketValue < 50_000) return 5_000;
  return 10_000;
}

/**
 * Взнос в фонд для одной стороны (владелец или арендатор).
 * Минимум 50 ₽/день чтобы не было смешных 15 ₽.
 */
function calcFundContrib(marketValue: number, days: number): number {
  const rate = getFundRate(marketValue);
  const raw = marketValue * rate * days;
  return parseFloat(Math.max(raw, 50 * days).toFixed(2));
}

export function calculateTotalPrice(
  pricePerDay: number,
  marketValue: number,
  days: number,
  ownerProtectionEnabled = true,
  renterProtectionEnabled = false,
): PriceBreakdown {
  const rent = pricePerDay * days;
  const serviceFee = parseFloat((rent * 0.10).toFixed(2));
  const taxFee = parseFloat((rent * 0.06).toFixed(2));
  const fundRate = getFundRate(marketValue);

  const ownerFundContribution = ownerProtectionEnabled && marketValue > 0
    ? calcFundContrib(marketValue, days)
    : 0;

  const renterFundContribution = renterProtectionEnabled && marketValue > 0
    ? calcFundContrib(marketValue, days)
    : 0;

  const combinedServiceFee = parseFloat((serviceFee + taxFee + ownerFundContribution).toFixed(2));
  const total = parseFloat((rent + combinedServiceFee + renterFundContribution).toFixed(2));
  const deposit = marketValue > 0 ? getDeposit(marketValue) : 0;

  return {
    rent,
    serviceFee,
    taxFee,
    ownerFundContribution,
    renterFundContribution,
    combinedServiceFee,
    fundRate,
    total,
    deposit,
  };
}
