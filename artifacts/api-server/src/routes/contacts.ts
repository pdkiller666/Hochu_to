import { Router } from "express";
import {
  db,
  contactBalancesTable,
  contactPurchasesTable,
  contactUnlocksTable,
  listingsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";

const router = Router();

/**
 * Гарантированно возвращает (создаёт при отсутствии) запись баланса для пользователя.
 * При первом обращении начисляет welcome-бонус (freeContactsBonus из platform_settings).
 */
async function ensureBalance(userId: number) {
  const [existing] = await db
    .select()
    .from(contactBalancesTable)
    .where(eq(contactBalancesTable.userId, userId))
    .limit(1);
  if (existing) return existing;

  const settings = await getPlatformSettings();
  const bonus = Math.max(0, settings.freeContactsBonus ?? 0);

  const [created] = await db
    .insert(contactBalancesTable)
    .values({
      userId,
      balance: bonus,
      bonusGranted: bonus > 0,
    })
    .returning();

  if (bonus > 0) {
    await db.insert(contactPurchasesTable).values({
      userId,
      kind: "bonus",
      amountRub: 0,
      contactsAdded: bonus,
    });
  }
  return created;
}

function isUnlimitedActive(b: { unlimitedUntil: Date | null }): boolean {
  return !!b.unlimitedUntil && b.unlimitedUntil.getTime() > Date.now();
}

// ─── GET /api/me/contact-balance ──────────────────────────────────────────────
router.get("/me/contact-balance", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const balance = await ensureBalance(userId);
  const settings = await getPlatformSettings();

  const purchases = await db
    .select()
    .from(contactPurchasesTable)
    .where(eq(contactPurchasesTable.userId, userId))
    .orderBy(desc(contactPurchasesTable.createdAt))
    .limit(50);

  res.json({
    balance: balance.balance,
    unlimitedUntil: balance.unlimitedUntil ? balance.unlimitedUntil.toISOString() : null,
    unlimitedActive: isUnlimitedActive(balance),
    bonusGranted: balance.bonusGranted,
    prices: {
      single: settings.contactPriceSingle,
      pack10: settings.contactPricePack10,
      unlimited30d: settings.contactPriceUnlimited30d,
    },
    contactLifetimeDays: settings.contactLifetimeDays,
    refundEnabled: settings.contactPackRefundEnabled,
    refundWindowDays: settings.contactPackRefundWindowDays,
    history: purchases.map(p => ({
      id: p.id,
      kind: p.kind,
      amountRub: p.amountRub,
      contactsAdded: p.contactsAdded,
      expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      refundedAt: p.refundedAt ? p.refundedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// ─── GET /api/me/contact-unlocks ──────────────────────────────────────────────
router.get("/me/contact-unlocks", requireAuth, async (req: AuthRequest, res) => {
  const unlocks = await db
    .select({
      id: contactUnlocksTable.id,
      listingId: contactUnlocksTable.listingId,
      source: contactUnlocksTable.source,
      unlockedAt: contactUnlocksTable.unlockedAt,
      expiresAt: contactUnlocksTable.expiresAt,
    })
    .from(contactUnlocksTable)
    .where(eq(contactUnlocksTable.userId, req.userId!))
    .orderBy(desc(contactUnlocksTable.unlockedAt))
    .limit(100);

  res.json({
    unlocks: unlocks.map(u => ({
      id: u.id,
      listingId: u.listingId,
      source: u.source,
      unlockedAt: u.unlockedAt.toISOString(),
      expiresAt: u.expiresAt ? u.expiresAt.toISOString() : null,
      active: !u.expiresAt || u.expiresAt.getTime() > Date.now(),
    })),
  });
});

// ─── POST /api/me/contact-balance/topup ───────────────────────────────────────
// MVP-стаб: моментально пополняет баланс. Реальная оплата (ЮKassa) — Этап 8.
router.post("/me/contact-balance/topup", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const kind = String((req.body as any)?.kind ?? "");
  if (!["single", "pack10", "unlimited30d"].includes(kind)) {
    res.status(400).json({ error: "validation_error", message: "Неверный тип покупки" });
    return;
  }

  const settings = await getPlatformSettings();
  await ensureBalance(userId);

  let amountRub = 0;
  let contactsAdded = 0;
  let expiresAt: Date | null = null;
  let updates: Record<string, any> = { updatedAt: new Date() };

  if (kind === "single") {
    amountRub = settings.contactPriceSingle;
    contactsAdded = 1;
    updates.balance = sql`${contactBalancesTable.balance} + 1`;
  } else if (kind === "pack10") {
    amountRub = settings.contactPricePack10;
    contactsAdded = 10;
    updates.balance = sql`${contactBalancesTable.balance} + 10`;
  } else if (kind === "unlimited30d") {
    amountRub = settings.contactPriceUnlimited30d;
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    updates.unlimitedUntil = expiresAt;
  }

  await db.update(contactBalancesTable).set(updates).where(eq(contactBalancesTable.userId, userId));
  const [purchase] = await db
    .insert(contactPurchasesTable)
    .values({
      userId,
      kind,
      amountRub,
      contactsAdded,
      expiresAt,
      paymentRef: "stub",
    })
    .returning();

  const [fresh] = await db
    .select()
    .from(contactBalancesTable)
    .where(eq(contactBalancesTable.userId, userId))
    .limit(1);

  res.json({
    purchase: {
      id: purchase.id,
      kind: purchase.kind,
      amountRub: purchase.amountRub,
      contactsAdded: purchase.contactsAdded,
      expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
      createdAt: purchase.createdAt.toISOString(),
    },
    balance: fresh?.balance ?? 0,
    unlimitedUntil: fresh?.unlimitedUntil ? fresh.unlimitedUntil.toISOString() : null,
    unlimitedActive: fresh ? isUnlimitedActive(fresh) : false,
  });
});

// ─── POST /api/listings/:id/contact-purchase ──────────────────────────────────
// Списывает 1 контакт с баланса (или использует безлимит) и возвращает телефон владельца.
// Возвращает кэшированный телефон, если контакт уже был разблокирован ранее.
router.post("/listings/:id/contact-purchase", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isFinite(listingId) || listingId <= 0) {
    res.status(400).json({ error: "validation_error", message: "Некорректный id" });
    return;
  }

  const [listing] = await db
    .select({
      id: listingsTable.id,
      ownerId: listingsTable.ownerId,
      ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
      isAvailable: listingsTable.isAvailable,
    })
    .from(listingsTable)
    .where(eq(listingsTable.id, listingId))
    .limit(1);
  if (!listing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }
  if (listing.ownerId === userId) {
    res.status(400).json({ error: "bad_request", message: "Это ваше объявление" });
    return;
  }

  const [owner] = await db
    .select({ phone: usersTable.phone, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, listing.ownerId))
    .limit(1);
  const ownerPhone = owner?.phone ?? null;
  const ownerName = owner?.name ?? null;
  if (!ownerPhone) {
    res.status(409).json({ error: "no_phone", message: "У владельца не указан телефон" });
    return;
  }

  const settings = await getPlatformSettings();

  // Если уже разблокирован и не истёк — отдаём бесплатно
  const [existing] = await db
    .select()
    .from(contactUnlocksTable)
    .where(and(eq(contactUnlocksTable.userId, userId), eq(contactUnlocksTable.listingId, listingId)))
    .limit(1);
  const stillActive =
    existing && (!existing.expiresAt || existing.expiresAt.getTime() > Date.now());
  if (stillActive) {
    res.json({
      alreadyUnlocked: true,
      ownerPhone,
      ownerName,
      source: existing.source,
      unlockedAt: existing.unlockedAt.toISOString(),
      expiresAt: existing.expiresAt ? existing.expiresAt.toISOString() : null,
      priceCharged: 0,
    });
    return;
  }

  const balance = await ensureBalance(userId);
  const unlimited = isUnlimitedActive(balance);
  let source: "balance" | "bonus" | "unlimited";
  let priceCharged = 0;

  if (unlimited) {
    source = "unlimited";
  } else if ((balance.balance ?? 0) > 0) {
    source = balance.bonusGranted && balance.balance <= (settings.freeContactsBonus ?? 0) ? "bonus" : "balance";
    await db
      .update(contactBalancesTable)
      .set({ balance: sql`${contactBalancesTable.balance} - 1`, updatedAt: new Date() })
      .where(eq(contactBalancesTable.userId, userId));
  } else {
    res.status(402).json({
      error: "insufficient_balance",
      message: "Недостаточно контактов на балансе. Купите контакт или пакет.",
      prices: {
        single: settings.contactPriceSingle,
        pack10: settings.contactPricePack10,
        unlimited30d: settings.contactPriceUnlimited30d,
      },
    });
    return;
  }

  const expiresAt =
    settings.contactLifetimeDays > 0
      ? new Date(Date.now() + settings.contactLifetimeDays * 24 * 60 * 60 * 1000)
      : null;

  // Создаём запись разблокировки (или обновляем истёкшую)
  if (existing) {
    await db
      .update(contactUnlocksTable)
      .set({ source, unlockedAt: new Date(), expiresAt })
      .where(eq(contactUnlocksTable.id, existing.id));
  } else {
    await db.insert(contactUnlocksTable).values({
      userId,
      listingId,
      source,
      expiresAt,
    });
  }

  res.json({
    alreadyUnlocked: false,
    ownerPhone,
    ownerName,
    source,
    priceCharged,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  });
});

export default router;
