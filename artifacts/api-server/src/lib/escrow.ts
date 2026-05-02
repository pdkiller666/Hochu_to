import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { createNotification } from "./notifications";

/**
 * Escrow Engine — Stage 39.
 *
 * Все операции с балансами выполняются в транзакции БД с SELECT ... FOR UPDATE
 * для исключения гонок данных. Комиссия округляется до 2 знаков в пользу платформы
 * (Math.ceil × 100 / 100).
 */

// ─── Утилиты ────────────────────────────────────────────────────────────────

/** Получить или создать кошелёк пользователя */
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

/** Округление комиссии — всегда в пользу платформы (ceiling до копейки) */
export function calcCommission(amount: number, percentStr: string | number): number {
  const pct = typeof percentStr === "string" ? parseFloat(percentStr) : percentStr;
  return Math.ceil(amount * (pct / 100) * 100) / 100;
}

// ─── Escrow Operations ───────────────────────────────────────────────────────

/**
 * HOLD: пополнение кошелька арендатора + заморозка суммы бронирования.
 * В mock-режиме виртуально зачисляем rentAmount на счёт арендатора,
 * затем сразу замораживаем — эмулируем внешний платёж.
 *
 * В production (yookassa) деньги приходят через webhook → используем topup + hold.
 */
export async function holdFunds(params: {
  renterId: number;
  ownerId: number;
  bookingId: number;
  amount: number;
  isMock?: boolean;
}): Promise<void> {
  const { renterId, bookingId, amount, isMock = true } = params;

  await db.transaction(async (tx) => {
    // SELECT ... FOR UPDATE — пессимистичная блокировка строки кошелька
    const rows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );

    let wallet = (rows.rows as any[])[0];
    if (!wallet) {
      // создаём кошелёк внутри транзакции
      const [created] = await tx
        .insert(walletsTable)
        .values({ userId: renterId, availableBalance: "0", frozenBalance: "0" })
        .returning();
      wallet = created;
    }

    const available = parseFloat(wallet.available_balance ?? "0");
    const frozen = parseFloat(wallet.frozen_balance ?? "0");

    if (isMock) {
      // В mock-режиме: зачисляем виртуально, затем замораживаем
      await tx
        .update(walletsTable)
        .set({
          availableBalance: "0",
          frozenBalance: (frozen + amount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, renterId));

      // Лог топапа (mock)
      await tx.insert(walletTransactionsTable).values({
        userId: renterId,
        amount: amount.toFixed(2),
        platformCommission: "0",
        type: "topup",
        status: "completed",
        referenceId: bookingId,
        referenceType: "booking",
        description: `Мок-пополнение под бронь #${bookingId}`,
      });
    } else {
      // Production: деньги уже на счёте (пришли через topup по webhook)
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

    // Лог hold
    await tx.insert(walletTransactionsTable).values({
      userId: renterId,
      amount: amount.toFixed(2),
      platformCommission: "0",
      type: "hold",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      description: `Холд по брони #${bookingId}`,
    });
  });

  // Уведомление арендатору
  await createNotification(
    renterId,
    "booking",
    `Средства ${amount.toFixed(2)} ₽ заморожены — ожидают передачи вещи по брони #${bookingId}`,
    `/dashboard`,
  ).catch(() => {});
}

/**
 * RELEASE (refund): возврат арендатору при отмене бронирования.
 * frozen → available арендатора.
 */
export async function releaseFunds(params: {
  renterId: number;
  bookingId: number;
  amount: number;
}): Promise<void> {
  const { renterId, bookingId, amount } = params;

  await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );
    const wallet = (rows.rows as any[])[0];
    if (!wallet) return; // нечего размораживать

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
      type: "refund",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      description: `Возврат по брони #${bookingId}`,
    });
  });

  await createNotification(
    renterId,
    "booking",
    `Возврат ${amount.toFixed(2)} ₽ — средства разморожены по брони #${bookingId}`,
    `/dashboard`,
  ).catch(() => {});
}

/**
 * PAYOUT: завершение аренды — разморозка + выплата владельцу (за вычетом комиссии).
 * frozen арендатора → available владельца (минус commission).
 *
 * @param commissionPercent — сервисная комиссия в % (из platform_settings)
 */
export async function payoutOwner(params: {
  renterId: number;
  ownerId: number;
  bookingId: number;
  amount: number;
  commissionPercent: string | number;
}): Promise<void> {
  const { renterId, ownerId, bookingId, amount, commissionPercent } = params;
  const commission = calcCommission(amount, commissionPercent);
  const ownerAmount = parseFloat((amount - commission).toFixed(2));

  await db.transaction(async (tx) => {
    // Блокируем кошельки обоих участников
    const renterRows = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${renterId} FOR UPDATE`
    );
    await tx.execute(
      sql`SELECT id FROM wallets WHERE user_id = ${ownerId} FOR UPDATE`
    );

    const renterWallet = (renterRows.rows as any[])[0];

    // Разморозка у арендатора
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

    // Получаем или создаём кошелёк владельца
    const ownerWalletRows = await tx.select().from(walletsTable).where(eq(walletsTable.userId, ownerId)).limit(1);
    let ownerBalance = 0;
    if (ownerWalletRows.length > 0) {
      ownerBalance = parseFloat(ownerWalletRows[0].availableBalance ?? "0");
    } else {
      await tx.insert(walletsTable).values({ userId: ownerId, availableBalance: "0", frozenBalance: "0" });
    }

    // Выплата владельцу
    await tx
      .update(walletsTable)
      .set({
        availableBalance: (ownerBalance + ownerAmount).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, ownerId));

    // Транзакция: комиссия (у арендатора)
    await tx.insert(walletTransactionsTable).values({
      userId: renterId,
      amount: commission.toFixed(2),
      platformCommission: commission.toFixed(2),
      type: "commission",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      description: `Комиссия платформы по брони #${bookingId}`,
    });

    // Транзакция: выплата (у владельца)
    await tx.insert(walletTransactionsTable).values({
      userId: ownerId,
      amount: ownerAmount.toFixed(2),
      platformCommission: commission.toFixed(2),
      type: "payout",
      status: "completed",
      referenceId: bookingId,
      referenceType: "booking",
      description: `Выплата за аренду (бронь #${bookingId})`,
    });
  });

  // Уведомления обоим
  await Promise.all([
    createNotification(
      renterId,
      "booking",
      `Аренда завершена. Средства ${amount.toFixed(2)} ₽ переведены владельцу по брони #${bookingId}`,
      `/dashboard`,
    ).catch(() => {}),
    createNotification(
      ownerId,
      "booking",
      `Поступление ${ownerAmount.toFixed(2)} ₽ на кошелёк — аренда завершена (бронь #${bookingId})`,
      `/dashboard`,
    ).catch(() => {}),
  ]);
}
