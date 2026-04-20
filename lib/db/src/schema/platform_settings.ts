import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Платформенные настройки — singleton-таблица (одна строка id=1).
 * Управляет всей экономикой проекта: комиссиями, фондом, прайсингом продвижения,
 * подписками и платёжными интеграциями. Обновления применяются мгновенно через кэш.
 */
export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),

  // ── Базовые комиссии (%) ────────────────────────────────────────────────
  /** Сервисная комиссия — удерживается из выплаты владельцу */
  serviceFeePercent: numeric("service_fee_percent", { precision: 5, scale: 2 }).default("10").notNull(),
  /** Налоговая компенсация (НПД самозанятый) — удерживается из выплаты владельцу */
  taxFeePercent: numeric("tax_fee_percent", { precision: 5, scale: 2 }).default("6").notNull(),
  /** Взнос арендатора в Гарантийный фонд (поверх аренды) */
  shieldFeePercent: numeric("shield_fee_percent", { precision: 5, scale: 2 }).default("5").notNull(),
  /** Минимальный взнос арендатора в фонд, ₽ */
  shieldFeeMin: integer("shield_fee_min").default(100).notNull(),
  /** Risk-coverage с владельца (зеркальное удержание в фонд) */
  riskCoveragePercent: numeric("risk_coverage_percent", { precision: 5, scale: 2 }).default("5").notNull(),
  /** Минимальный риск-коверидж, ₽ */
  riskCoverageMin: integer("risk_coverage_min").default(100).notNull(),

  // ── Залог ──────────────────────────────────────────────────────────────
  /** Множитель залога относительно дневной цены */
  depositMultiplier: numeric("deposit_multiplier", { precision: 5, scale: 2 }).default("2").notNull(),
  /** Минимальный залог, ₽ */
  depositMin: integer("deposit_min").default(1500).notNull(),

  // ── Лимиты Гарантийного фонда (множители pricePerDay × N) ──────────────
  protMultElectronics: integer("prot_mult_electronics").default(50).notNull(),
  protMultTools: integer("prot_mult_tools").default(20).notNull(),
  protMultLeisure: integer("prot_mult_leisure").default(15).notNull(),
  protMultSpecialMachinery: integer("prot_mult_special_machinery").default(10).notNull(),
  /** Жёсткий потолок для пользователей < newUserDealsThreshold сделок */
  newUserProtectionCap: integer("new_user_protection_cap").default(25000).notNull(),
  newUserDealsThreshold: integer("new_user_deals_threshold").default(3).notNull(),

  // ── Платное продвижение (₽) ───────────────────────────────────────────
  vipPrice7d: integer("vip_price_7d").default(199).notNull(),
  vipPrice14d: integer("vip_price_14d").default(349).notNull(),
  vipPrice30d: integer("vip_price_30d").default(599).notNull(),
  urgentPrice3d: integer("urgent_price_3d").default(99).notNull(),
  urgentPrice7d: integer("urgent_price_7d").default(199).notNull(),
  boostPrice24h: integer("boost_price_24h").default(49).notNull(),

  // ── Подписки владельцев (₽/мес) ───────────────────────────────────────
  subscriptionProMonthly: integer("subscription_pro_monthly").default(499).notNull(),
  subscriptionBusinessMonthly: integer("subscription_business_monthly").default(1990).notNull(),
  subscriptionBusinessCommissionPercent: numeric("subscription_business_commission_percent", { precision: 5, scale: 2 }).default("5").notNull(),

  // ── Совместные покупки ────────────────────────────────────────────────
  jointPurchaseFeePercent: numeric("joint_purchase_fee_percent", { precision: 5, scale: 2 }).default("3").notNull(),

  // ── Платёжные системы ──────────────────────────────────────────────────
  /** Юр. модель: self_employed (НПД), ip, ooo */
  paymentMode: text("payment_mode").default("self_employed").notNull(),
  yookassaEnabled: boolean("yookassa_enabled").default(false).notNull(),
  yookassaShopId: text("yookassa_shop_id"),
  yookassaTestMode: boolean("yookassa_test_mode").default(true).notNull(),
  sbpEnabled: boolean("sbp_enabled").default(false).notNull(),
  sbpMerchantId: text("sbp_merchant_id"),
  cloudpaymentsEnabled: boolean("cloudpayments_enabled").default(false).notNull(),
  cloudpaymentsPublicId: text("cloudpayments_public_id"),

  // ── Метаданные ─────────────────────────────────────────────────────────
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;
