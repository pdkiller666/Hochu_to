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
 * Реалистичный залог: 2× суточная цена, мин. 5 000 ₽, макс. 15 000 ₽.
 * Психологически комфортно — это не «заморозить стоимость Макбука».
 */
export function getDeposit(pricePerDay: number): number {
  return Math.min(Math.max(Math.round(pricePerDay * 2), 5_000), 15_000);
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
  const fundContribution = parseFloat((marketValue * fundRate * days).toFixed(2));
  const total = parseFloat((rent + serviceFee + taxFee + fundContribution).toFixed(2));
  const deposit = getDeposit(pricePerDay);
  return { rent, serviceFee, taxFee, fundContribution, fundRate, total, deposit };
}
