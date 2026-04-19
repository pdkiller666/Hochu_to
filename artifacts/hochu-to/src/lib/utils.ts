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

/**
 * Максимально правдоподобная рыночная стоимость исходя из цены аренды.
 * Типичная ставка аренды в РФ: 0.5–2% от стоимости в сутки.
 * Используем нижнюю границу (0.5%) как «потолок»: pricePerDay / 0.005 = pricePerDay * 200.
 * Если владелец указал ВЫШЕ этого порога — стоимость подозрительно завышена.
 */
export function getMaxSensibleMarketValue(pricePerDay: number): number {
  return pricePerDay * 200;
}

/**
 * Ограничиваем рыночную стоимость для расчёта фонда, чтобы
 * владелец не завышал стоимость и не получал несправедливую компенсацию.
 */
export function clampMarketValueForFund(marketValue: number, pricePerDay: number): number {
  const maxSensible = getMaxSensibleMarketValue(pricePerDay);
  return Math.min(marketValue, maxSensible);
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
 * Чем дороже вещь — тем меньше процент.
 */
export function getFundRate(marketValue: number): number {
  if (marketValue <= 50_000) return 0.005;
  if (marketValue <= 150_000) return 0.002;
  return 0.001;
}

/**
 * Ступенчатый залог по рыночной стоимости вещи.
 */
export function getDeposit(marketValue: number): number {
  if (marketValue < 10_000) return 2_000;
  if (marketValue < 50_000) return 5_000;
  return 10_000;
}

/**
 * Взнос в фонд для одной стороны (владелец или арендатор).
 * Минимум 50 ₽/день.
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

  // Для фонда используем скорректированную стоимость (защита от накрутки)
  const clampedMV = clampMarketValueForFund(marketValue, pricePerDay);
  const fundRate = getFundRate(clampedMV);

  const ownerFundContribution = ownerProtectionEnabled && clampedMV > 0
    ? calcFundContrib(clampedMV, days)
    : 0;

  const renterFundContribution = renterProtectionEnabled && clampedMV > 0
    ? calcFundContrib(clampedMV, days)
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
