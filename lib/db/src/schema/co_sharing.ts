import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Stage 23a — Модуль «Совместные покупки» (Co-Sharing).
 *
 * Юр. база: Договор простого товарищества (ГК РФ). Платформа — IT-агент,
 * пользователи покупают «Доли» в физическом имуществе (НЕ ценные бумаги).
 *
 * Жизненный цикл pool: funding → purchasing → active → liquidated
 * Альтернативные исходы: canceled (на funding не собрали)
 *
 * Связь с soft-launch:
 *   - collection_method='p2p_direct'   — beta: дольщики переводят инициатору на СБП
 *   - collection_method='platform_escrow' — commercial: ЮKassa-эскроу
 *
 * Стратегии закупки (procurement_strategy):
 *   - 'self_managed' — инициатор покупает сам, реимбурсимент после Цифрового Акта
 *   - 'platform_concierge' — платформа закупает по безналу, выдаёт штрих-код
 *
 * ID-конвенция: serial (как везде в проекте — НЕ uuid).
 * FK + enum + check constraints: домен финансово-юридический, целостность критична.
 */

// ── Enum'ы для state-machine (защита от мусорных значений на уровне БД) ────
export const poolStatusEnum = pgEnum("pool_status", [
  "funding",     // идёт сбор
  "purchasing",  // средства собраны, идёт закупка вещи
  "active",      // вещь куплена и доступна для аренды
  "liquidated",  // пул расформирован, доходы распределены
  "canceled",    // не собрали в срок — деньги возвращены
]);

export const poolCollectionMethodEnum = pgEnum("pool_collection_method", [
  "p2p_direct",       // beta: дольщик → СБП-телефон инициатора напрямую
  "platform_escrow",  // commercial: холд на ЮKassa
]);

export const poolProcurementStrategyEnum = pgEnum("pool_procurement_strategy", [
  "self_managed",        // инициатор покупает сам, реимбурсимент
  "platform_concierge",  // платформа закупает, штрих-код
]);

export const poolSharePaymentStatusEnum = pgEnum("pool_share_payment_status", [
  "pending",            // обещано, ждём перевода
  "user_transferred",   // юзер утверждает «я перевёл» (СБП)
  "creator_confirmed",  // инициатор подтвердил поступление (СБП)
  "escrow_held",        // деньги в холде ЮKassa (commercial)
]);

export const shareOfferStatusEnum = pgEnum("share_offer_status", [
  "open",
  "sold",
  "canceled",
]);

/**
 * Stage 28 — Полный выкуп пула.
 *
 * Жизненный цикл buyout_request:
 *   pending → completed     (инициатор довёл свой share до 100%, пул ликвидирован)
 *   pending → canceled      (инициатор отменил до того, как кто-то confirmed; либо все participants отказались)
 *
 * Жизненный цикл buyout_participant:
 *   pending_approval     — участник ещё не дал согласие; UI у participant: «Согласиться → показать СБП».
 *                          UI у initiator: «Ждём согласия» (mark-transferred НЕ доступен).
 *   user_transferred     — инициатор пометил «я перевёл деньги участнику».
 *                          UI у participant: «Деньги получил» (атомарный merge + удаление его share).
 *   confirmed            — participant подтвердил → его доля смерджена с initiator'ом.
 */
export const buyoutStatusEnum = pgEnum("buyout_status", [
  "pending",
  "completed",
  "canceled",
]);

export const buyoutParticipantStatusEnum = pgEnum("buyout_participant_status", [
  "pending_approval",
  "user_transferred",
  "confirmed",
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const poolsTable = pgTable(
  "pools",
  {
    id: serial("id").primaryKey(),
    /** Инициатор пула — он же первый дольщик и (по умолчанию) первый Хранитель. */
    creatorId: integer("creator_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),

    /** Что покупаем — ссылка на товар (DNS, Ozon, etc.) и человеко-читаемое название. */
    itemUrl: text("item_url"),
    title: text("title").notNull(),
    description: text("description"),

    /** Целевая сумма сбора (вкл. комиссию платформы и буфер на доставку). */
    targetAmountRub: integer("target_amount_rub").notNull(),
    /** Фактическая цена покупки — заполняется после чека/акта. */
    actualPurchasePriceRub: integer("actual_purchase_price_rub"),
    /** Касса обслуживания пула: излишки сбора + 10% с внешних аренд + ежедневный сбор совладельцев. */
    maintenanceFundBalance: integer("maintenance_fund_balance").default(0).notNull(),

    collectionMethod: poolCollectionMethodEnum("collection_method").notNull(),
    /** Реквизиты получателя при p2p_direct (телефон СБП / номер карты). Null при escrow. */
    creatorPaymentDetails: text("creator_payment_details"),

    procurementStrategy: poolProcurementStrategyEnum("procurement_strategy").notNull(),

    status: poolStatusEnum("status").default("funding").notNull(),
    /** Включена ли защита фонда (как у обычных listings). По умолчанию да. */
    protectionMode: boolean("protection_mode").default(true).notNull(),

    /** Дедлайн сбора. Если статус остался funding — pool автоматически переходит в canceled. */
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    statusExpiresIdx: index("pools_status_expires_idx").on(t.status, t.expiresAt),
    creatorIdx: index("pools_creator_idx").on(t.creatorId),
    targetAmountPositive: check("pools_target_amount_positive", sql`${t.targetAmountRub} > 0`),
    actualPriceNonNeg: check("pools_actual_price_non_neg", sql`${t.actualPurchasePriceRub} IS NULL OR ${t.actualPurchasePriceRub} >= 0`),
    maintenanceNonNeg: check("pools_maintenance_non_neg", sql`${t.maintenanceFundBalance} >= 0`),
  }),
);

/**
 * Доли в пуле. Один пользователь = одна строка-доля на пул.
 * UNIQUE(pool_id, user_id) предотвращает «фантомные» дубликаты.
 * Сумма всех share_percentage по pool_id должна быть = 100 после funding (валидация в бизнес-логике).
 */
export const poolSharesTable = pgTable(
  "pool_shares",
  {
    id: serial("id").primaryKey(),
    poolId: integer("pool_id").notNull().references(() => poolsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),

    /** Процент владения 0.01–100 с двумя знаками. */
    sharePercentage: numeric("share_percentage", { precision: 5, scale: 2 }).notNull(),
    /** Сумма доли в рублях (целых). */
    amountRub: integer("amount_rub").notNull(),

    paymentStatus: poolSharePaymentStatusEnum("payment_status").default("pending").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    poolUserUniq: uniqueIndex("pool_shares_pool_user_uniq").on(t.poolId, t.userId),
    poolIdx: index("pool_shares_pool_idx").on(t.poolId),
    userIdx: index("pool_shares_user_idx").on(t.userId),
    sharePercentRange: check(
      "pool_shares_percent_range",
      sql`${t.sharePercentage} > 0 AND ${t.sharePercentage} <= 100`,
    ),
    amountNonNeg: check("pool_shares_amount_non_neg", sql`${t.amountRub} >= 0`),
  }),
);

/**
 * Вторичный рынок долей (Stage 25). Совладелец может продать свою долю другому юзеру.
 * Платформа берёт комиссию (отдельная настройка в будущем).
 *
 * Жизненный цикл оффера:
 *   1. open + buyer_id=NULL          — выставлено на продажу
 *   2. open + buyer_id=X (reserved)  — покупатель резервирует, переводит P2P
 *   3. sold                          — продавец подтвердил получение, доли мерджатся
 *   4. canceled                      — продавец отменил (или TTL истёк)
 *
 * Beta: seller_payment_details — СБП продавца, показывается покупателю на /buy.
 * Commercial (Stage 24): эскроу через ЮKassa — поле станет необязательным.
 */
export const shareOffersTable = pgTable(
  "share_offers",
  {
    id: serial("id").primaryKey(),
    shareId: integer("share_id").notNull().references(() => poolSharesTable.id, { onDelete: "cascade" }),
    sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),

    /** Цена продажи в рублях (с учётом износа на момент выставления). */
    priceRub: integer("price_rub").notNull(),

    status: shareOfferStatusEnum("status").default("open").notNull(),

    /** Stage 25: текущий резервирующий покупатель. NULL = свободно. */
    buyerId: integer("buyer_id").references(() => usersTable.id, { onDelete: "restrict" }),
    /** Stage 25: момент резервации; используется для TTL (сейчас опционально). */
    reservedAt: timestamp("reserved_at"),
    /** Stage 25: СБП-реквизиты продавца, показываются покупателю при /buy. */
    sellerPaymentDetails: text("seller_payment_details"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    shareStatusIdx: index("share_offers_share_status_idx").on(t.shareId, t.status),
    sellerIdx: index("share_offers_seller_idx").on(t.sellerId),
    buyerIdx: index("share_offers_buyer_idx").on(t.buyerId),
    priceNonNeg: check("share_offers_price_non_neg", sql`${t.priceRub} >= 0`),
  }),
);

// ── Zod-схемы и типы ─────────────────────────────────────────────────────────
export const insertPoolSchema = createInsertSchema(poolsTable).omit({ id: true, createdAt: true });
export type InsertPool = z.infer<typeof insertPoolSchema>;
export type Pool = typeof poolsTable.$inferSelect;

export const insertPoolShareSchema = createInsertSchema(poolSharesTable).omit({ id: true, createdAt: true });
export type InsertPoolShare = z.infer<typeof insertPoolShareSchema>;
export type PoolShare = typeof poolSharesTable.$inferSelect;

export const insertShareOfferSchema = createInsertSchema(shareOffersTable).omit({ id: true, createdAt: true });
export type InsertShareOffer = z.infer<typeof insertShareOfferSchema>;
export type ShareOffer = typeof shareOffersTable.$inferSelect;

/**
 * Stage 28 — Запрос на полный выкуп пула.
 * Один pending-запрос на пул (partial unique). После завершения/отмены — статус меняется,
 * unique снимается → можно создавать новый.
 */
export const buyoutRequestsTable = pgTable(
  "buyout_requests",
  {
    id: serial("id").primaryKey(),
    poolId: integer("pool_id")
      .notNull()
      .references(() => poolsTable.id, { onDelete: "cascade" }),
    initiatorId: integer("initiator_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: buyoutStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    poolIdx: index("buyout_requests_pool_idx").on(t.poolId),
    initiatorIdx: index("buyout_requests_initiator_idx").on(t.initiatorId),
    /**
     * Только один pending-выкуп на пул в каждый момент времени.
     * Partial unique = срабатывает только когда status='pending'.
     */
    pendingPerPoolUniq: uniqueIndex("buyout_requests_pending_per_pool_uniq")
      .on(t.poolId)
      .where(sql`status = 'pending'`),
  }),
);

/**
 * Участник выкупа = одна доля = одна строка. Каждой не-инициаторной доле
 * на момент создания запроса соответствует ровно одна запись.
 *
 * shareId хранится как «снимок» доли, но при confirmed share может быть удалена
 * (мы её мерджим с initiator'ом). Поэтому FK с onDelete: 'set null' — для аудита.
 */
export const buyoutParticipantsTable = pgTable(
  "buyout_participants",
  {
    id: serial("id").primaryKey(),
    buyoutRequestId: integer("buyout_request_id")
      .notNull()
      .references(() => buyoutRequestsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    /** Snapshot: какая доля участвует. После confirmed эта запись в pool_shares удалится. */
    shareId: integer("share_id").references(() => poolSharesTable.id, { onDelete: "set null" }),
    /** Snapshot: процент доли на момент создания запроса (нужен для merge). */
    sharePercentage: numeric("share_percentage", { precision: 5, scale: 2 }).notNull(),
    /** Snapshot: рублёвая сумма доли на момент создания запроса (для merge amount). */
    shareAmountRub: integer("share_amount_rub").notNull(),
    /** Размер выплаты этому участнику (residualValue × sharePct/100). */
    priceRub: integer("price_rub").notNull(),
    status: buyoutParticipantStatusEnum("status").default("pending_approval").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    requestIdx: index("buyout_participants_request_idx").on(t.buyoutRequestId),
    userIdx: index("buyout_participants_user_idx").on(t.userId),
    /** В рамках одного выкупа — один участник = одна строка. */
    requestUserUniq: uniqueIndex("buyout_participants_request_user_uniq").on(
      t.buyoutRequestId,
      t.userId,
    ),
    priceNonNeg: check("buyout_participants_price_non_neg", sql`${t.priceRub} >= 0`),
    sharePercentRange: check(
      "buyout_participants_percent_range",
      sql`${t.sharePercentage} > 0 AND ${t.sharePercentage} <= 100`,
    ),
  }),
);

export const insertBuyoutRequestSchema = createInsertSchema(buyoutRequestsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBuyoutRequest = z.infer<typeof insertBuyoutRequestSchema>;
export type BuyoutRequest = typeof buyoutRequestsTable.$inferSelect;

export const insertBuyoutParticipantSchema = createInsertSchema(buyoutParticipantsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBuyoutParticipant = z.infer<typeof insertBuyoutParticipantSchema>;
export type BuyoutParticipant = typeof buyoutParticipantsTable.$inferSelect;
