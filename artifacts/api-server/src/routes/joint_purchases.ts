import { Router } from "express";
import { db, jointPurchasesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const purchases = await db
    .select({
      id: jointPurchasesTable.id,
      itemName: jointPurchasesTable.itemName,
      description: jointPurchasesTable.description,
      targetAmount: jointPurchasesTable.targetAmount,
      collectedAmount: jointPurchasesTable.collectedAmount,
      participantsCount: jointPurchasesTable.participantsCount,
      status: jointPurchasesTable.status,
      authorName: usersTable.name,
      createdAt: jointPurchasesTable.createdAt,
    })
    .from(jointPurchasesTable)
    .leftJoin(usersTable, eq(jointPurchasesTable.authorId, usersTable.id))
    .orderBy(jointPurchasesTable.createdAt);

  res.json(purchases.map(p => ({
    ...p,
    targetAmount: parseFloat(p.targetAmount as unknown as string),
    collectedAmount: parseFloat(p.collectedAmount as unknown as string),
    authorName: p.authorName ?? "Аноним",
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const { itemName, description, targetAmount, contactEmail, contactPhone } = req.body;

  if (!itemName || !targetAmount || !contactEmail) {
    res.status(400).json({ error: "validation_error", message: "Заполните обязательные поля" });
    return;
  }

  const [purchase] = await db.insert(jointPurchasesTable).values({
    itemName,
    description: description ?? null,
    targetAmount: targetAmount.toString(),
    contactEmail,
    contactPhone: contactPhone ?? null,
    collectedAmount: "0",
    participantsCount: 0,
    status: "open",
  }).returning();

  res.status(201).json({
    id: purchase.id,
    itemName: purchase.itemName,
    description: purchase.description ?? undefined,
    targetAmount: parseFloat(purchase.targetAmount as unknown as string),
    collectedAmount: 0,
    participantsCount: 0,
    status: purchase.status,
    createdAt: purchase.createdAt.toISOString(),
  });
});

export default router;
