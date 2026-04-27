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

  // ── Анти-фрод гарантийного фонда ────────────────────────────────────────
  /** % от поступлений в фонд, который держится как неприкосновенный резерв (не выдаётся по claims) */
  fundReserveRatioPct: integer("fund_reserve_ratio_pct").default(20).notNull(),
  /** Максимальная сумма одной выплаты по claim, ₽ (0 = без лимита) */
  maxClaimAmountSingleRub: integer("max_claim_amount_single_rub").default(150000).notNull(),
  /** Максимум активных/одобренных claims одного пользователя за календарный месяц */
  maxClaimsPerUserMonth: integer("max_claims_per_user_month").default(3).notNull(),
  /** Лимит одной выплаты как % от maxProtectionLimit объявления (0 = выкл, 100 = можно весь лимит) */
  maxClaimAmountPerListingPct: integer("max_claim_amount_per_listing_pct").default(100).notNull(),

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

  // ── Совместные покупки (legacy joint_purchases — только сбор-трекер) ──
  jointPurchaseFeePercent: numeric("joint_purchase_fee_percent", { precision: 5, scale: 2 }).default("3").notNull(),

  // ── Stage 23a: Co-Sharing (новый модуль с долями и хранителем) ────────
  /** Комиссия платформы за самостоятельную покупку (инициатор покупает сам, потом реимбурсимент) */
  poolFeeSelfManagedPercent: numeric("pool_fee_self_managed_percent", { precision: 5, scale: 2 }).default("5").notNull(),
  /** Комиссия за консьерж-сервис (платформа закупает по безналу, штрих-код) — VIP, выше */
  poolFeeConciergePercent: numeric("pool_fee_concierge_percent", { precision: 5, scale: 2 }).default("12").notNull(),
  /** Ежедневный тех. сбор с совладельца, когда он берёт вещь для себя (₽) */
  coOwnerDailyFeeRub: integer("co_owner_daily_fee_rub").default(100).notNull(),
  /**
   * Stage 26: % амортизации физической вещи за одну завершённую аренду.
   * Каждая бронь со статусом `completed` инкрементирует `listings.wear_and_tear_meter` на +1,
   * а residual = initialPrice * (1 - meter * depreciationPerRentalPercent / 100), но не ниже 10%.
   * Default 1% означает: после 100 аренд вещь стоит минимум 10% от исходной (потолок амортизации).
   */
  depreciationPerRentalPercent: integer("depreciation_per_rental_percent").default(1).notNull(),

  // ── Бесплатный тариф «Объявление» (Free) ───────────────────────────────
  /** Глобальный переключатель бесплатного тарифа */
  freeListingsEnabled: boolean("free_listings_enabled").default(true).notNull(),
  /** Лимит активных Free-объявлений на одного владельца (защита от спама) */
  freeListingsMaxPerOwner: integer("free_listings_max_per_owner").default(10).notNull(),
  /** Требовать верифицированный телефон для публикации Free */
  freeListingsRequirePhone: boolean("free_listings_require_phone").default(true).notNull(),
  /** Когда показывать телефон владельца Free-объявления арендатору:
   *  'instant' — сразу в карточке, 'after_payment' — после оплаты контакта */
  freeShowOwnerPhoneMode: text("free_show_owner_phone_mode").default("after_payment").notNull(),

  // ── Платный доступ к контактам (с арендатора) ──────────────────────────
  /** Цена за разблокировку 1 контакта владельца */
  contactPriceSingle: integer("contact_price_single").default(49).notNull(),
  /** Цена пакета «10 контактов» */
  contactPricePack10: integer("contact_price_pack10").default(299).notNull(),
  /** Цена пакета «безлимит на 30 дней» */
  contactPriceUnlimited30d: integer("contact_price_unlimited_30d").default(699).notNull(),
  /** Бесплатных контактов новому арендатору (welcome-бонус) */
  freeContactsBonus: integer("free_contacts_bonus").default(2).notNull(),
  /** Срок жизни купленного контакта в днях (0 = навсегда) */
  contactLifetimeDays: integer("contact_lifetime_days").default(0).notNull(),
  /** Разрешить возврат неиспользованного пакета */
  contactPackRefundEnabled: boolean("contact_pack_refund_enabled").default(true).notNull(),
  /** Окно возврата пакета, дней */
  contactPackRefundWindowDays: integer("contact_pack_refund_window_days").default(7).notNull(),

  // ── Апгрейд бронирования Free → Premium (арендатором) ──────────────────
  /** Разрешить арендатору доплатить % и получить защиту по Free-объявлению */
  freeToPremiumUpgradeEnabled: boolean("free_to_premium_upgrade_enabled").default(true).notNull(),

  // ── Витрина и сортировка ──────────────────────────────────────────────
  /** Сортировка каталога по умолчанию: 'protected_first' | 'newest' | 'price_asc' | 'price_desc' */
  defaultCatalogSort: text("default_catalog_sort").default("protected_first").notNull(),
  /** Минимальная доля Premium-объявлений в первой странице выдачи (%) */
  minPremiumShareInResults: integer("min_premium_share_in_results").default(60).notNull(),
  /** Показывать бейджи формата сделки на карточках */
  showFormatBadges: boolean("show_format_badges").default(true).notNull(),

  // ── Soft-Launch / Бета-режим ───────────────────────────────────────────
  /**
   * Главный тумблер коммерческого режима.
   * false (по умолчанию, бета) — все сборы платформы = 0₽, контакты открываются
   * мгновенно без оплаты, продвижение покупается через мок-флоу. UI флоу не
   * меняется визуально — пользователь видит те же опции, но «0 ₽».
   * true — реальные деньги через ЮKassa с idempotency-key и capture:false для холдов.
   */
  isCommercialMode: boolean("is_commercial_mode").default(false).notNull(),

  // ── Платёжные системы ──────────────────────────────────────────────────
  /** Юр. модель: self_employed (НПД), ip, ooo */
  paymentMode: text("payment_mode").default("self_employed").notNull(),
  yookassaEnabled: boolean("yookassa_enabled").default(false).notNull(),
  yookassaShopId: text("yookassa_shop_id"),
  yookassaSecretKey: text("yookassa_secret_key"),
  yookassaTestMode: boolean("yookassa_test_mode").default(true).notNull(),
  sbpEnabled: boolean("sbp_enabled").default(false).notNull(),
  sbpMerchantId: text("sbp_merchant_id"),
  cloudpaymentsEnabled: boolean("cloudpayments_enabled").default(false).notNull(),
  cloudpaymentsPublicId: text("cloudpayments_public_id"),

  // ── Stage 30A: AI Gateway ──────────────────────────────────────────────
  /**
   * Активный провайдер генерации описаний для объявлений.
   * 'mock' — заглушка с эмодзи (по умолчанию, без расходов и без ключей);
   * 'openai' — ChatGPT через OPENAI_API_KEY;
   * 'amvera' — российский Amvera AI Inference (llama8b) через AMVERA_API_TOKEN.
   * При сбое реального API всегда graceful-fallback в 'mock'.
   */
  activeAiProvider: text("active_ai_provider").default("mock").notNull(),

  // ── Метаданные ─────────────────────────────────────────────────────────
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;
