import { db } from "@workspace/db";
import { platformSettingsTable, type PlatformSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * In-memory кэш платформенных настроек.
 * Все экономические расчёты сервера читают отсюда.
 * Обновляется через POST /admin/settings → invalidate().
 */
let cache: PlatformSettings | null = null;
let cacheLoadedAt = 0;
const TTL_MS = 60_000; // безопасный fallback если кто-то напрямую правит БД

const DEFAULTS = {
  serviceFeePercent: "10",
  taxFeePercent: "6",
  shieldFeePercent: "5",
  shieldFeeMin: 100,
  riskCoveragePercent: "5",
  riskCoverageMin: 100,
  depositMultiplier: "2",
  depositMin: 1500,
  protMultElectronics: 50,
  protMultTools: 20,
  protMultLeisure: 15,
  protMultSpecialMachinery: 10,
  newUserProtectionCap: 25000,
  newUserDealsThreshold: 3,
  vipPrice7d: 199,
  vipPrice14d: 349,
  vipPrice30d: 599,
  urgentPrice3d: 99,
  urgentPrice7d: 199,
  boostPrice24h: 49,
  subscriptionProMonthly: 499,
  subscriptionBusinessMonthly: 1990,
  subscriptionBusinessCommissionPercent: "5",
  jointPurchaseFeePercent: "3",
  // Stage 23a — Co-Sharing
  poolFeeSelfManagedPercent: "5",
  poolFeeConciergePercent: "12",
  coOwnerDailyFeeRub: 100,
  // Stage 26: износ за одну завершённую аренду, %
  depreciationPerRentalPercent: 1,
  isCommercialMode: false,
  paymentMode: "self_employed",
  yookassaEnabled: false,
  yookassaTestMode: true,
  sbpEnabled: false,
  cloudpaymentsEnabled: false,
  // Stage 30A — AI Gateway
  activeAiProvider: "mock",
  // Stage 39 — Escrow Engine
  paymentProvider: "mock",
};

export async function ensurePlatformSettings(): Promise<PlatformSettings> {
  const existing = await db.select().from(platformSettingsTable).limit(1);
  if (existing.length > 0) {
    cache = existing[0];
    cacheLoadedAt = Date.now();
    return existing[0];
  }
  const [created] = await db.insert(platformSettingsTable).values(DEFAULTS as any).returning();
  cache = created;
  cacheLoadedAt = Date.now();
  return created;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cacheLoadedAt < TTL_MS) return cache;
  return ensurePlatformSettings();
}

export function invalidatePlatformSettings() {
  cache = null;
  cacheLoadedAt = 0;
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettings>,
  updatedBy?: number,
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const { id, updatedAt, ...rest } = patch as any;
  const [updated] = await db
    .update(platformSettingsTable)
    .set({ ...rest, updatedAt: new Date(), updatedBy: updatedBy ?? null })
    .where(eq(platformSettingsTable.id, current.id))
    .returning();
  cache = updated;
  cacheLoadedAt = Date.now();
  return updated;
}

// ─── Helpers для расчётов ──────────────────────────────────────────────

export function num(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v);
}

export interface PriceRates {
  serviceFeePercent: number;
  taxFeePercent: number;
  shieldFeePercent: number;
  shieldFeeMin: number;
  riskCoveragePercent: number;
  riskCoverageMin: number;
  depositMultiplier: number;
  depositMin: number;
}

export function ratesFromSettings(s: PlatformSettings): PriceRates {
  return {
    serviceFeePercent: num(s.serviceFeePercent),
    taxFeePercent: num(s.taxFeePercent),
    shieldFeePercent: num(s.shieldFeePercent),
    shieldFeeMin: s.shieldFeeMin,
    riskCoveragePercent: num(s.riskCoveragePercent),
    riskCoverageMin: s.riskCoverageMin,
    depositMultiplier: num(s.depositMultiplier),
    depositMin: s.depositMin,
  };
}

/** Публичные поля настроек (отдаются без авторизации для клиентского калькулятора) */
export function publicSettings(s: PlatformSettings) {
  return {
    serviceFeePercent: num(s.serviceFeePercent),
    taxFeePercent: num(s.taxFeePercent),
    shieldFeePercent: num(s.shieldFeePercent),
    shieldFeeMin: s.shieldFeeMin,
    riskCoveragePercent: num(s.riskCoveragePercent),
    riskCoverageMin: s.riskCoverageMin,
    depositMultiplier: num(s.depositMultiplier),
    depositMin: s.depositMin,
    protMultElectronics: s.protMultElectronics,
    protMultTools: s.protMultTools,
    protMultLeisure: s.protMultLeisure,
    protMultSpecialMachinery: s.protMultSpecialMachinery,
    newUserProtectionCap: s.newUserProtectionCap,
    newUserDealsThreshold: s.newUserDealsThreshold,
    jointPurchaseFeePercent: num(s.jointPurchaseFeePercent),
    // Stage 23a — Co-Sharing (публично: для калькулятора будущего UI пулов)
    poolFeeSelfManagedPercent: num(s.poolFeeSelfManagedPercent),
    poolFeeConciergePercent: num(s.poolFeeConciergePercent),
    coOwnerDailyFeeRub: s.coOwnerDailyFeeRub,
    depreciationPerRentalPercent: s.depreciationPerRentalPercent,
    isCommercialMode: s.isCommercialMode,
    paymentMode: s.paymentMode,
    yookassaEnabled: s.yookassaEnabled,
    sbpEnabled: s.sbpEnabled,
    cloudpaymentsEnabled: s.cloudpaymentsEnabled,
    // ── Free + контакты + витрина (нужны клиенту для UI) ────────────────
    freeListingsEnabled: s.freeListingsEnabled,
    freeListingsMaxPerOwner: s.freeListingsMaxPerOwner,
    freeListingsRequirePhone: s.freeListingsRequirePhone,
    freeShowOwnerPhoneMode: s.freeShowOwnerPhoneMode,
    contactPriceSingle: s.contactPriceSingle,
    contactPricePack10: s.contactPricePack10,
    contactPriceUnlimited30d: s.contactPriceUnlimited30d,
    freeContactsBonus: s.freeContactsBonus,
    contactLifetimeDays: s.contactLifetimeDays,
    contactPackRefundEnabled: s.contactPackRefundEnabled,
    contactPackRefundWindowDays: s.contactPackRefundWindowDays,
    freeToPremiumUpgradeEnabled: s.freeToPremiumUpgradeEnabled,
    defaultCatalogSort: s.defaultCatalogSort,
    minPremiumShareInResults: s.minPremiumShareInResults,
    showFormatBadges: s.showFormatBadges,
    // Stage 39 — Escrow Engine
    paymentProvider: s.paymentProvider,
  };
}
