import { Router } from "express";
import { db, reviewsTable, usersTable, bookingsTable, listingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { recomputeListingRating } from "../lib/listing-counters.js";

const router = Router();

function formatReview(r: any, author: any, reviewee?: any) {
  return {
    id: r.id,
    reviewType: r.reviewType,
    reviewerRole: r.reviewerRole,
    listingId: r.listingId ?? undefined,
    bookingId: r.bookingId ?? undefined,
    bookingNumber: r.bookingNumber ?? undefined,
    authorId: r.authorId,
    authorName: author?.name ?? "Пользователь",
    authorAvatar: author?.avatar ?? undefined,
    revieweeId: r.revieweeId ?? undefined,
    revieweeName: reviewee?.name ?? undefined,
    revieweeAvatar: reviewee?.avatar ?? undefined,
    rating: r.rating,
    text: r.text ?? undefined,
    responseText: r.responseText ?? undefined,
    responseAt: r.responseAt ? r.responseAt.toISOString() : undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/reviews/can-review/:bookingId — check what types of reviews can be left
router.get("/can-review/:bookingId", requireAuth, async (req: AuthRequest, res) => {
  const bookingId = parseInt(req.params.bookingId as string);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: "bad_request" }); return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking || booking.status !== "completed") {
    res.json({ canReviewListing: false, canReviewRenter: false });
    return;
  }

  const userId = req.userId!;
  const isRenter = booking.renterId === userId;
  const isOwner = booking.ownerId === userId;

  if (!isRenter && !isOwner) {
    res.json({ canReviewListing: false, canReviewRenter: false }); return;
  }

  // Check existing reviews for this booking by this user
  const existing = await db.select({ reviewType: reviewsTable.reviewType })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.bookingId, bookingId), eq(reviewsTable.authorId, userId)));

  const hasListingReview = existing.some(r => r.reviewType === "listing");
  const hasRenterReview = existing.some(r => r.reviewType === "renter");

  res.json({
    canReviewListing: isRenter && !hasListingReview,
    canReviewRenter: isOwner && !hasRenterReview,
    isRenter,
    isOwner,
    bookingNumber: booking.bookingNumber ?? undefined,
  });
});

// POST /api/reviews — create a review
// reviewType = 'listing' (renter reviews the item/owner) or 'renter' (owner reviews the renter)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bookingId, reviewType, rating, text } = req.body;

  if (!bookingId || !reviewType || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "validation_error", message: "Неверные данные отзыва" });
    return;
  }
  if (!["listing", "renter"].includes(reviewType)) {
    res.status(400).json({ error: "validation_error", message: "Неверный тип отзыва" });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" }); return;
  }
  if (booking.status !== "completed") {
    res.status(400).json({ error: "booking_not_completed", message: "Можно оставить отзыв только по завершённой сделке" });
    return;
  }

  const userId = req.userId!;
  const isRenter = booking.renterId === userId;
  const isOwner = booking.ownerId === userId;

  if (!isRenter && !isOwner) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа к этому бронированию" }); return;
  }
  if (reviewType === "listing" && !isRenter) {
    res.status(403).json({ error: "forbidden", message: "Только арендатор может оставить отзыв на объявление" }); return;
  }
  if (reviewType === "renter" && !isOwner) {
    res.status(403).json({ error: "forbidden", message: "Только владелец может оставить отзыв об арендаторе" }); return;
  }

  // Check duplicate
  const [dup] = await db.select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.bookingId, bookingId), eq(reviewsTable.authorId, userId), eq(reviewsTable.reviewType, reviewType)))
    .limit(1);
  if (dup) {
    res.status(409).json({ error: "already_reviewed", message: "Вы уже оставили этот тип отзыва" }); return;
  }

  const [listing] = await db.select({ id: listingsTable.id }).from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1);

  const [review] = await db.insert(reviewsTable).values({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber ?? null,
    reviewType,
    reviewerRole: isRenter ? "renter" : "owner",
    listingId: reviewType === "listing" ? booking.listingId : null,
    authorId: userId,
    revieweeId: reviewType === "listing" ? booking.ownerId : booking.renterId,
    rating,
    text: text ?? null,
  }).returning();

  // Stage 19e: пересчёт avgRating/reviewCount для объявления
  if (review.listingId) {
    await recomputeListingRating(review.listingId);
  }

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [reviewee] = await db.select().from(usersTable)
    .where(eq(usersTable.id, review.revieweeId!))
    .limit(1);

  res.status(201).json(formatReview(review, author, reviewee));
});

// POST /api/reviews/:id/response — respond to a review (the reviewee replies)
router.post("/:id/response", requireAuth, async (req: AuthRequest, res) => {
  const reviewId = parseInt(req.params.id as string);
  const { text } = req.body;

  if (!text || text.trim().length < 2) {
    res.status(400).json({ error: "validation_error", message: "Текст ответа слишком короткий" }); return;
  }

  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, reviewId)).limit(1);
  if (!review) {
    res.status(404).json({ error: "not_found", message: "Отзыв не найден" }); return;
  }
  if (review.revieweeId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Ответить может только тот, о ком оставлен отзыв" }); return;
  }
  if (review.responseText) {
    res.status(409).json({ error: "already_responded", message: "Ответ уже добавлен" }); return;
  }

  const [updated] = await db.update(reviewsTable)
    .set({ responseText: text.trim(), responseAt: new Date() })
    .where(eq(reviewsTable.id, reviewId))
    .returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
  const [reviewee] = updated.revieweeId
    ? await db.select().from(usersTable).where(eq(usersTable.id, updated.revieweeId)).limit(1)
    : [undefined];

  res.json(formatReview(updated, author, reviewee));
});

// GET /api/reviews/listing/:listingId — all listing reviews
router.get("/listing/:listingId", async (req, res) => {
  const listingId = parseInt(req.params.listingId as string);
  if (isNaN(listingId)) { res.status(400).json({ error: "bad_request" }); return; }

  const rows = await db
    .select({
      review: reviewsTable,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(and(eq(reviewsTable.listingId, listingId), eq(reviewsTable.reviewType, "listing")))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  res.json(rows.map(r => formatReview(r.review, { name: r.authorName, avatar: r.authorAvatar })));
});

// GET /api/reviews/user/:userId — reviews ABOUT a user
// type=owner → listing reviews on their items | type=renter → renter reviews | type=all (default)
router.get("/user/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId as string);
  const type = (req.query.type as string) || "all";
  if (isNaN(userId)) { res.status(400).json({ error: "bad_request" }); return; }

  const conditions: any[] = [eq(reviewsTable.revieweeId, userId)];

  if (type === "owner") {
    conditions.push(eq(reviewsTable.reviewType, "listing"));
  } else if (type === "renter") {
    conditions.push(eq(reviewsTable.reviewType, "renter"));
  }

  const rows = await db
    .select({
      review: reviewsTable,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(and(...conditions))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  // For listing reviews, also get listing title
  const withListingTitles = await Promise.all(rows.map(async r => {
    let listingTitle: string | undefined;
    if (r.review.listingId) {
      const [lst] = await db.select({ title: listingsTable.title, listingNumber: listingsTable.listingNumber })
        .from(listingsTable).where(eq(listingsTable.id, r.review.listingId)).limit(1);
      listingTitle = lst ? `${lst.title}` : undefined;
    }
    return {
      ...formatReview(r.review, { name: r.authorName, avatar: r.authorAvatar }),
      listingTitle,
    };
  }));

  res.json(withListingTitles);
});

export default router;
