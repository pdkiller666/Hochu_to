import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable, poolsTable, poolSharesTable } from "@workspace/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { createNotification } from "./notifications.js";

/**
 * Escrow Engine — Stage 39 (updated Stage 40).
 *
 * Все операции с балансами выполняются в транзакции БД с SELECT ... FOR UPDATE
 * для исключения гонок данных. Комиссия округляется до 2 знаков в пользу платформы.
 */

export async function getOrCreateWallet(userId: number) {
  const existing = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(walletsTable)
    .values({ userId, availableBalance: "0", frozenBalance: "0", currency: "RUB" })
    .returning();
  return created;
}

export function calcCommission(amount: number, percentStr: string | number): number {
  const pct = typeof percentStr === "string" ? parseFloat(percentStr) : percentStr;
  return Math.ceil(amount * (pct / 100) * 100) / 100;
}

// ─── holdFunds ───────────────────────────────────────────────────────────────

export async function holdFunds(params: {
  renterId: number;
  ownerId: number;
  bookingId: number;
  bookingNumber?: string;
  amount: number;
  isMock?: boolean;
}): Promise<void> {
  const { renterId, bookingId, bookingNumber, amount, isMock = true } = params;
  const ref = bookingNumber ?? `#${bookingId}`;

  await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );

    let wallet = (rows.rows as any[])[0];
    if (!wallet) {
      const [created] = await tx
        .insert(walletsTable)
        .values({ userId: renterId, availableBalance: "0", frozenBalance: "0" })
        .returning();
      wallet = created;
    }

    const available = parseFloat(wallet.available_balance ?? "0");
    const frozen = parseFloat(wallet.frozen_balance ?? "0");

    if (isMock) {
      await tx
        .update(walletsTable)
        .set({
          availableBalance: "0",
          frozenBalance: (frozen + amount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, renterId));

      await tx.insert(walletTransactionsTable).values({
        userId: renterId,
        amount: amount.toFixed(2),
        platformCommission: "0",
        type: "topup",
        status: "completed",
        referenceId: bookingId,
        referenceType: "booking",
        bookingNumber: bookingNumber ?? null,
        description: `Мок-пополнение под бронь ${ref}`,
      });
    } else {
      if (available < amount) {
        throw new Error("insufficient_funds");
      }
      await tx
        .update(walletsTable)
        .set({
          availableBalance: (available - amount).toFixed(2),
          frozenBalance: (frozen + amount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, renterId));
    }

    await tx.insert(walletTransactionsTable).values({
      userId: renterId,
      amount: amount.toFixed(2),
      platformCommission: "0",
      type: "hold",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      bookingNumber: bookingNumber ?? null,
      description: `Заморожено по брони ${ref}`,
    });
  });

  await createNotification({
    userId: renterId,
    type: "booking_confirmed",
    title: "Средства заморожены",
    message: `${amount.toFixed(2)} ₽ заморожены — ожидают передачи вещи по брони ${ref}`,
    link: "/dashboard",
  }).catch(() => {});
}

// ─── releaseFunds ─────────────────────────────────────────────────────────────

export async function releaseFunds(params: {
  renterId: number;
  bookingId: number;
  bookingNumber?: string;
  amount: number;
}): Promise<void> {
  const { renterId, bookingId, bookingNumber, amount } = params;
  const ref = bookingNumber ?? `#${bookingId}`;

  await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );
    const wallet = (rows.rows as any[])[0];
    if (!wallet) return;

    const frozen = parseFloat(wallet.frozen_balance ?? "0");
    const available = parseFloat(wallet.available_balance ?? "0");
    const toRelease = Math.min(amount, frozen);

    await tx
      .update(walletsTable)
      .set({
        frozenBalance: Math.max(0, frozen - toRelease).toFixed(2),
        availableBalance: (available + toRelease).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, renterId));

    await tx.insert(walletTransactionsTable).values({
      userId: renterId,
      amount: toRelease.toFixed(2),
      platformCommission: "0",
      type: "release",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      bookingNumber: bookingNumber ?? null,
      description: `Возврат средств — отмена брони ${ref}`,
    });
  });

  await createNotification({
    userId: renterId,
    type: "booking_cancelled",
    title: "Средства возвращены",
    message: `${amount.toFixed(2)} ₽ разморожены по брони ${ref}`,
    link: "/dashboard",
  }).catch(() => {});
}

// ─── payoutOwner ──────────────────────────────────────────────────────────────

export async function payoutOwner(params: {
  renterId: number;
  ownerId: number;
  bookingId: number;
  bookingNumber?: string;
  amount: number;
  commissionPercent: string | number;
}): Promise<void> {
  const { renterId, ownerId, bookingId, bookingNumber, amount, commissionPercent } = params;
  const ref = bookingNumber ?? `#${bookingId}`;
  const commission = calcCommission(amount, commissionPercent);
  const ownerAmount = parseFloat((amount - commission).toFixed(2));

  await db.transaction(async (tx) => {
    const renterRows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );
    await tx.execute(
      sql`SELECT id FROM wallets WHERE user_id = ${ownerId} FOR UPDATE`
    );

    const renterWallet = (renterRows.rows as any[])[0];

    if (renterWallet) {
      const frozen = parseFloat(renterWallet.frozen_balance ?? "0");
      await tx
        .update(walletsTable)
        .set({
          frozenBalance: Math.max(0, frozen - amount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, renterId));
    }

    const ownerWalletRows = await tx.select().from(walletsTable).where(eq(walletsTable.userId, ownerId)).limit(1);
    let ownerBalance = 0;
    if (ownerWalletRows.length > 0) {
      ownerBalance = parseFloat(ownerWalletRows[0].availableBalance ?? "0");
    } else {
      await tx.insert(walletsTable).values({ userId: ownerId, availableBalance: "0", frozenBalance: "0" });
    }

    await tx
      .update(walletsTable)
      .set({
        availableBalance: (ownerBalance + ownerAmount).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, ownerId));

    await tx.insert(walletTransactionsTable).values({
      userId: renterId,
      amount: commission.toFixed(2),
      platformCommission: commission.toFixed(2),
      type: "commission",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      bookingNumber: bookingNumber ?? null,
      description: `Комиссия платформы по брони ${ref}`,
    });

    await tx.insert(walletTransactionsTable).values({
      userId: ownerId,
      amount: ownerAmount.toFixed(2),
      platformCommission: commission.toFixed(2),
      type: "payout",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      bookingNumber: bookingNumber ?? null,
      description: `Выплата за аренду по брони ${ref}`,
    });
  });

  await Promise.all([
    createNotification({
      userId: renterId,
      type: "booking_completed",
      title: "Аренда завершена",
      message: `${amount.toFixed(2)} ₽ переведены владельцу по брони ${ref}`,
      link: "/dashboard",
    }).catch(() => {}),
    createNotification({
      userId: ownerId,
      type: "booking_completed",
      title: `Поступление ${ownerAmount.toFixed(2)} ₽`,
      message: `Аренда завершена, средства зачислены (бронь ${ref})`,
      link: "/dashboard",
    }).catch(() => {}),
  ]);
}

// ─── payoutPoolShareholders ───────────────────────────────────────────────────

/**
 * Распределяет доход с аренды пула между всеми дольщиками.
 *
 * Алгоритм:
 *  1. Из ownerPayout вычитается poolFeePercent% → пополняет maintenanceFundBalance пула.
 *  2. Остаток делится между подтверждёнными дольщиками пропорционально sharePercentage.
 *  3. Каждому зачисляется на availableBalance кошелька + создаётся WalletTransaction.
 *  4. Уведомление на /dashboard?tab=wallet каждому получателю.
 *
 * Активна в обоих режимах (beta + commercial) — экономика пула не зависит от ЮKassa.
 */
export async function payoutPoolShareholders(params: {
  poolId: number;
  renterId: number;
  bookingId: number;
  bookingNumber?: string;
  ownerPayout: number;
  poolFeePercent: number;
}): Promise<void> {
  const { poolId, renterId, bookingId, bookingNumber, ownerPayout, poolFeePercent } = params;
  const ref = bookingNumber ?? `#${bookingId}`;

  const shares = await db
    .select({ userId: poolSharesTable.userId, sharePercentage: poolSharesTable.sharePercentage })
    .from(poolSharesTable)
    .where(and(
      eq(poolSharesTable.poolId, poolId),
      inArray(poolSharesTable.paymentStatus, ["creator_confirmed", "escrow_held"] as any),
    ));

  if (shares.length === 0) return;

  const maintenanceCut = Math.ceil(ownerPayout * (poolFeePercent / 100) * 100) / 100;
  const distributable = Math.max(0, parseFloat((ownerPayout - maintenanceCut).toFixed(2)));
  const totalPct = shares.reduce((s, sh) => s + parseFloat(sh.sharePercentage ?? "0"), 0);

  await db.transaction(async (tx) => {
    // Списываем из замороженных средств арендатора
    const renterRows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );
    const renterWallet = (renterRows.rows as any[])[0];
    if (renterWallet) {
      const frozen = parseFloat(renterWallet.frozen_balance ?? "0");
      await tx
        .update(walletsTable)
        .set({ frozenBalance: Math.max(0, frozen - ownerPayout).toFixed(2), updatedAt: new Date() })
        .where(eq(walletsTable.userId, renterId));
    }

    // Зачисляем каждому дольщику пропорционально его доле
    for (const share of shares) {
      const pct = parseFloat(share.sharePercentage ?? "0");
      const normalizedPct = totalPct > 0 ? pct / totalPct : 0;
      const credit = Math.floor(distributable * normalizedPct * 100) / 100;
      if (credit <= 0) continue;

      const rows = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${share.userId} FOR UPDATE`
      );
      let wallet = (rows.rows as any[])[0];
      if (!wallet) {
        const [created] = await tx
          .insert(walletsTable)
          .values({ userId: share.userId, availableBalance: "0", frozenBalance: "0" })
          .returning();
        wallet = created;
      }

      const available = parseFloat(wallet.available_balance ?? "0");
      await tx
        .update(walletsTable)
        .set({ availableBalance: (available + credit).toFixed(2), updatedAt: new Date() })
        .where(eq(walletsTable.userId, share.userId));

      await tx.insert(walletTransactionsTable).values({
        userId: share.userId,
        amount: credit.toFixed(2),
        platformCommission: "0",
        type: "payout",
        status: "completed",
        referenceId: bookingId,
        referenceType: "pool_rental",
        bookingNumber: bookingNumber ?? null,
        description: `Доход с аренды пула (${pct.toFixed(1)}%), бронь ${ref}`,
      });
    }

    // Отчисление в фонд обслуживания пула
    if (maintenanceCut > 0) {
      await tx
        .update(poolsTable)
        .set({ maintenanceFundBalance: sql`${poolsTable.maintenanceFundBalance} + ${maintenanceCut.toFixed(2)}` })
        .where(eq(poolsTable.id, poolId));

      await tx.insert(walletTransactionsTable).values({
        userId: renterId,
        amount: maintenanceCut.toFixed(2),
        platformCommission: "0",
        type: "commission",
        status: "completed",
        referenceId: bookingId,
        referenceType: "pool_rental",
        bookingNumber: bookingNumber ?? null,
        description: `Фонд обслуживания пула, бронь ${ref}`,
      });
    }
  });

  // Уведомления дольщикам (best-effort, вне транзакции)
  for (const share of shares) {
    const pct = parseFloat(share.sharePercentage ?? "0");
    const normalizedPct = totalPct > 0 ? pct / totalPct : 0;
    const credit = Math.floor(distributable * normalizedPct * 100) / 100;
    if (credit <= 0) continue;
    await createNotification({
      userId: share.userId,
      type: "booking_completed",
      title: `💰 Доход с аренды +${credit.toFixed(2)} ₽`,
      message: `Зачислено ${credit.toFixed(2)} ₽ — ваша доля ${pct.toFixed(1)}% по брони ${ref}`,
      link: "/dashboard?tab=wallet",
    }).catch(() => {});
  }
}
