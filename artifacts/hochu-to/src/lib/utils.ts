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
  total: number;
  deposit: number;
}

export function calculateTotalPrice(
  pricePerDay: number,
  marketValue: number,
  days: number
): PriceBreakdown {
  const rent = pricePerDay * days;
  const serviceFee = parseFloat((rent * 0.10).toFixed(2));
  const taxFee = parseFloat((rent * 0.06).toFixed(2));
  const fundContribution = parseFloat((marketValue * 0.005 * days).toFixed(2));
  const total = parseFloat((rent + serviceFee + taxFee + fundContribution).toFixed(2));
  const deposit = parseFloat((marketValue * 0.10).toFixed(2));
  return { rent, serviceFee, taxFee, fundContribution, total, deposit };
}
