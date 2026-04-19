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
  fundContribution: number;
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

export function calculateTotalPrice(
  pricePerDay: number,
  marketValue: number,
  days: number
): PriceBreakdown {
  const rent = pricePerDay * days;
  const serviceFee = parseFloat((rent * 0.10).toFixed(2));
  const taxFee = parseFloat((rent * 0.06).toFixed(2));
  const fundRate = getFundRate(marketValue);
  // Минимальный взнос в фонд: 50 ₽/день, чтобы дешёвые вещи не давали смешные 15 ₽
  const rawFundContribution = marketValue * fundRate * days;
  const fundContribution = parseFloat(Math.max(rawFundContribution, 50 * days).toFixed(2));
  const total = parseFloat((rent + serviceFee + taxFee + fundContribution).toFixed(2));
  const deposit = getDeposit(marketValue);
  return { rent, serviceFee, taxFee, fundContribution, fundRate, total, deposit };
}
