import { Router } from "express";
import { db, usersTable, listingsTable, bookingsTable, categoriesTable, regionsTable, reviewsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";

const router = Router();

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // UPLOADS_DIR создаётся при старте приложения в uploadsDir.ts
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.jpg`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Только изображения"));
  },
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (!user) {
    res.status(404).json({ error: "not_found", message: "Пользователь не найден" });
    return;
  }

  const [listingsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.ownerId, id));
  const [bookingsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(eq(bookingsTable.renterId, id));
  const [completedBookings] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(sql`${bookingsTable.ownerId} = ${id} AND ${bookingsTable.status} = 'completed'`);

  // Real ratings: as owner = avg of listing reviews on their items; as renter = avg of renter reviews about them
  const [ownerRatingResult] = await db.select({
    avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
    count: sql<number>`COUNT(*)::int`,
  }).from(reviewsTable)
    .where(sql`${reviewsTable.revieweeId} = ${id} AND ${reviewsTable.reviewType} = 'listing'`);

  const [renterRatingResult] = await db.select({
    avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
    count: sql<number>`COUNT(*)::int`,
  }).from(reviewsTable)
    .where(sql`${reviewsTable.revieweeId} = ${id} AND ${reviewsTable.reviewType} = 'renter'`);

  const ownerRating = ownerRatingResult?.avg ?? 0;
  const ownerReviewCount = ownerRatingResult?.count ?? 0;
  const renterRating = renterRatingResult?.avg ?? 0;
  const renterReviewCount = renterRatingResult?.count ?? 0;

  // Combined rating = weighted average
  const totalReviews = ownerReviewCount + renterReviewCount;
  const combinedRating = totalReviews > 0
    ? (ownerRating * ownerReviewCount + renterRating * renterReviewCount) / totalReviews
    : 0;

  res.json({
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? undefined,
    role: user.role,
    bio: user.bio ?? undefined,
    phone: user.phone ?? undefined,
    telegram: user.telegram ?? undefined,
    website: user.website ?? undefined,
    regionId: user.regionId ?? undefined,
    createdAt: user.createdAt.toISOString(),
    totalListings: listingsCount?.count ?? 0,
    totalBookings: bookingsCount?.count ?? 0,
    completedDeals: completedBookings?.count ?? 0,
    rating: Math.round(combinedRating * 10) / 10,
    reviewCount: totalReviews,
    ownerRating: Math.round(ownerRating * 10) / 10,
    ownerReviewCount,
    renterRating: Math.round(renterRating * 10) / 10,
    renterReviewCount,
  });
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  if (id !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const { name, phone, avatar, regionId, role, bio, telegram, website } = req.body;
  const validRoles = ["renter", "owner"];

  const [updated] = await db.update(usersTable).set({
    ...(name && { name }),
    ...(phone !== undefined && { phone }),
    ...(avatar !== undefined && { avatar }),
    ...(regionId !== undefined && { regionId }),
    ...(role && validRoles.includes(role) && { role }),
    ...(bio !== undefined && { bio }),
    ...(telegram !== undefined && { telegram }),
    ...(website !== undefined && { website }),
  }).where(eq(usersTable.id, id)).returning();

  let regionName: string | undefined;
  if (updated.regionId) {
    const [region] = await db.select().from(regionsTable).where(eq(regionsTable.id, updated.regionId)).limit(1);
    regionName = region?.name;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone ?? undefined,
    avatar: updated.avatar ?? undefined,
    bio: updated.bio ?? undefined,
    telegram: updated.telegram ?? undefined,
    website: updated.website ?? undefined,
    regionId: updated.regionId ?? undefined,
    regionName,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/:id/avatar", requireAuth, uploadAvatar.single("avatar"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  if (id !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "no_file", message: "Файл не загружен" });
    return;
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  // Delete old avatar file if it was uploaded
  const [currentUser] = await db.select({ avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (currentUser?.avatar && currentUser.avatar.startsWith("/uploads/")) {
    const oldFilename = path.basename(currentUser.avatar);
    const oldPath = path.join(UPLOADS_DIR, oldFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const [updated] = await db.update(usersTable).set({ avatar: avatarUrl }).where(eq(usersTable.id, id)).returning();

  let regionName: string | undefined;
  if (updated.regionId) {
    const [region] = await db.select().from(regionsTable).where(eq(regionsTable.id, updated.regionId)).limit(1);
    regionName = region?.name;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone ?? undefined,
    avatar: updated.avatar ?? undefined,
    bio: updated.bio ?? undefined,
    telegram: updated.telegram ?? undefined,
    website: updated.website ?? undefined,
    regionId: updated.regionId ?? undefined,
    regionName,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.put("/:id/credentials", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  if (id !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const { currentPassword, newEmail, newPassword } = req.body as {
    currentPassword?: string;
    newEmail?: string;
    newPassword?: string;
  };

  if (!currentPassword) {
    res.status(400).json({ error: "validation_error", message: "Введите текущий пароль" });
    return;
  }

  if (!newEmail && !newPassword) {
    res.status(400).json({ error: "validation_error", message: "Укажите новый email или пароль" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "not_found", message: "Пользователь не найден" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "wrong_password", message: "Неверный текущий пароль" });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (newEmail && newEmail !== user.email) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, newEmail)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "conflict", message: "Этот email уже используется" });
      return;
    }
    updates.email = newEmail;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      res.status(400).json({ error: "validation_error", message: "Пароль должен быть не менее 6 символов" });
      return;
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    res.json({ success: true, message: "Нет изменений" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));

  res.json({ success: true, message: "Данные успешно обновлены" });
});

router.get("/:id/listings", async (req, res) => {
  const id = parseInt(req.params.id);

  const listings = await db
    .select({
      id: listingsTable.id,
      title: listingsTable.title,
      description: listingsTable.description,
      pricePerDay: listingsTable.pricePerDay,
      deposit: listingsTable.deposit,
      categoryId: listingsTable.categoryId,
      categoryName: categoriesTable.name,
      regionId: listingsTable.regionId,
      regionName: regionsTable.name,
      photos: listingsTable.photos,
      isAvailable: listingsTable.isAvailable,
      ownerId: listingsTable.ownerId,
      ownerName: usersTable.name,
      ownerAvatar: usersTable.avatar,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(eq(listingsTable.ownerId, id))
    .orderBy(listingsTable.createdAt);

  const listingsWithRating = listings.map(l => ({
    ...l,
    pricePerDay: parseFloat(l.pricePerDay as unknown as string),
    deposit: l.deposit ? parseFloat(l.deposit as unknown as string) : undefined,
    createdAt: l.createdAt.toISOString(),
    rating: 0,
    reviewCount: 0,
  }));

  res.json(listingsWithRating);
});

export default router;
