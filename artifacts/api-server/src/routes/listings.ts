import { Router } from "express";
import { db, listingsTable, usersTable, categoriesTable, regionsTable, reviewsTable, bookingsTable, listingViewsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, or, desc, count, ilike, isNotNull } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { verifyAccessToken } from "../lib/auth-token.js";
import { CreateListingBody } from "@workspace/api-zod";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";
import { getPlatformSettings } from "../lib/platform-settings.js";

const router = Router();

function deleteUploadedFiles(photos: string[]): void {
  for (const url of photos) {
    if (!url.startsWith("/uploads/")) continue;
    const filename = path.basename(url);
    if (!filename || filename.includes("..")) continue;
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // best-effort, ignore errors
    }
  }
}

function generateListingNumber(id: number): string {
  const year = new Date().getFullYear();
  return `ВТ-${year}-${String(id).padStart(6, "0")}`;
}

async function getListingWithDetails(id: number) {
  const [listing] = await db
    .select({
      id: listingsTable.id,
      listingNumber: listingsTable.listingNumber,
      title: listingsTable.title,
      description: listingsTable.description,
      pricePerDay: listingsTable.pricePerDay,
      deposit: listingsTable.deposit,
      itemCategory: listingsTable.itemCategory,
      maxProtectionLimit: listingsTable.maxProtectionLimit,
      requiresManualVerification: listingsTable.requiresManualVerification,
      ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
      categoryId: listingsTable.categoryId,
      categoryName: categoriesTable.name,
      categorySlug: categoriesTable.slug,
      regionId: listingsTable.regionId,
      regionName: regionsTable.name,
      regionSlug: regionsTable.slug,
      city: listingsTable.city,
      lat: listingsTable.lat,
      lng: listingsTable.lng,
      meetingAddress: listingsTable.meetingAddress,
      photos: listingsTable.photos,
      isAvailable: listingsTable.isAvailable,
      ownerId: listingsTable.ownerId,
      ownerName: usersTable.name,
      ownerAvatar: usersTable.avatar,
      ownerPhone: usersTable.phone,
      // Stage 19g — для бейджа «Проверенный владелец» в карточке объявления.
      ownerIsVerified: usersTable.isVerified,
      ownerTrustScore: usersTable.trustScore,
      ownerCompletedDealsCount: usersTable.completedDealsCount,
      ownerRole: usersTable.role,
      isFeatured: listingsTable.isFeatured,
      featuredUntil: listingsTable.featuredUntil,
      isUrgent: listingsTable.isUrgent,
      urgentUntil: listingsTable.urgentUntil,
      boostedUntil: listingsTable.boostedUntil,
      // Stage 19e: денормализованные счётчики
      bookingCount: listingsTable.bookingCount,
      reviewCount: listingsTable.reviewCount,
      avgRating: listingsTable.avgRating,
      favoritesCount: listingsTable.favoritesCount,
      // Stage 19c: просмотры за последние 30 дней (для виджета и метрик)
      views30d: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM listing_views lv
        WHERE lv.listing_id = ${listingsTable.id}
          AND lv.created_at > NOW() - INTERVAL '30 days'
      ), 0)`,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(eq(listingsTable.id, id))
    .limit(1);

  return listing;
}

/**
 * Stage 19c — фиксируем просмотр объявления.
 *
 * Дедупликация в течение часа через UNIQUE INDEX (listing_id, viewer_key, hour_bucket)
 * + INSERT ... ON CONFLICT DO NOTHING. Не выбрасывает наружу — best-effort.
 *
 * viewer_key:
 *  - "u:<userId>" — если в заголовке Authorization есть валидный JWT
 *    (маршрут публичный, requireAuth не вешаем; парсим токен вручную, чтобы не ломать гостям).
 *  - "ip:<req.ip>" — иначе. req.ip уже учитывает trust proxy (`app.set('trust proxy', 1)`),
 *    поэтому брать X-Forwarded-For вручную не нужно.
 */
async function trackListingView(listingId: number, req: any): Promise<void> {
  try {
    let viewerKey: string | null = null;
    const authHeader = req.headers?.authorization as string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyAccessToken(authHeader.slice(7));
      if (payload && typeof payload.userId === "number") {
        viewerKey = `u:${payload.userId}`;
      }
    }
    if (!viewerKey) {
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      viewerKey = `ip:${ip}`;
    }
    const now = new Date();
    const hourBucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
    await db.insert(listingViewsTable).values({ listingId, viewerKey, hourBucket }).onConflictDoNothing();
  } catch {
    // best-effort: трекинг просмотров не должен ломать ответ юзеру
  }
}

/** Вычисляет лимит защитного фонда по категории с учётом опыта владельца.
 *  Все числа берутся из platform_settings — ни одного хардкода. */
async function calcMaxProtection(
  pricePerDay: number,
  itemCategory: string | null,
  completedDealsCount: number,
): Promise<number> {
  const s = await getPlatformSettings();
  const multipliers: Record<string, number> = {
    electronics: s.protMultElectronics,
    tools:       s.protMultTools,
    leisure:     s.protMultLeisure,
    special_machinery: s.protMultSpecialMachinery,
  };
  const multiplier = multipliers[itemCategory ?? "tools"] ?? s.protMultTools;
  const raw = pricePerDay * multiplier;
  return completedDealsCount < s.newUserDealsThreshold ? Math.min(raw, s.newUserProtectionCap) : raw;
}

router.get("/", async (req, res) => {
  const settings = await getPlatformSettings();
  const defaultSort = settings.defaultCatalogSort ?? "new";
  const { category, region, city, minPrice, maxPrice, search, safeOnly, quality, page = "1", limit = "12", sort = defaultSort } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  // Базовые условия (без региона) — нужны и для основного запроса, и для fallback "других регионов"
  const baseConditions = [eq(listingsTable.isAvailable, true)];

  if (category) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, category)).limit(1);
    if (cat) baseConditions.push(eq(listingsTable.categoryId, cat.id));
  }

  if (minPrice) baseConditions.push(gte(listingsTable.pricePerDay, minPrice));
  if (maxPrice) baseConditions.push(lte(listingsTable.pricePerDay, maxPrice));
  if (safeOnly === "true" || safeOnly === "1") {
    baseConditions.push(eq(listingsTable.ownerProtectionEnabled, true));
  }
  // quality=true — порог качества для маркетинговых блоков (например, «Новинки» на главной):
  // только объявления с хотя бы одним фото и описанием ≥ 50 символов.
  // В каталоге не применяется по умолчанию, чтобы пользователь мог видеть всё.
  if (quality === "true" || quality === "1") {
    baseConditions.push(sql`COALESCE(array_length(${listingsTable.photos}, 1), 0) >= 1`);
    baseConditions.push(sql`COALESCE(char_length(${listingsTable.description}), 0) >= 50`);
  }
  if (search) {
    // ВАЖНО: на некоторых хостингах (включая Amvera) PostgreSQL запущен с locale=C,
    // где ILIKE и LOWER()/UPPER() корректно обрабатывают только ASCII, а кириллицу
    // оставляют без изменений. Поэтому case-folding делаем в Node.js (где Unicode
    // работает корректно) и проверяем все распространённые варианты регистра через OR.
    const lower = search.toLowerCase();
    const upper = search.toUpperCase();
    const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
    const variants = Array.from(new Set([search, lower, upper, capitalized]));
    const conds: any[] = [];
    for (const v of variants) {
      const pat = `%${v}%`;
      conds.push(sql`${listingsTable.title} LIKE ${pat}`);
      conds.push(sql`COALESCE(${listingsTable.description}, '') LIKE ${pat}`);
    }
    baseConditions.push(or(...conds)!);
  }

  // Региональное условие добавляем поверх базовых
  let regionCondition: any = null;
  let resolvedRegionId: number | null = null;
  if (region) {
    const [reg] = await db.select().from(regionsTable).where(eq(regionsTable.slug, region)).limit(1);
    if (reg) {
      resolvedRegionId = reg.id;
      regionCondition = eq(listingsTable.regionId, reg.id);
    }
  }

  // Фильтр по конкретному населённому пункту (city).
  // Используем ручной LIKE с вариантами регистра (аналогично поиску по title),
  // т.к. PostgreSQL с locale=C не обрабатывает ILIKE для кириллицы.
  let cityCondition: any = null;
  if (city && city.trim()) {
    const c = city.trim();
    const lower = c.toLowerCase();
    const upper = c.toUpperCase();
    const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
    const variants = Array.from(new Set([c, lower, upper, capitalized]));
    const cityConds: any[] = [];
    for (const v of variants) {
      cityConds.push(sql`COALESCE(${listingsTable.city}, '') LIKE ${v}`);
    }
    cityCondition = or(...cityConds);
  }

  const locationConditions = [regionCondition, cityCondition].filter(Boolean);
  const conditions = locationConditions.length > 0 ? [...baseConditions, ...locationConditions] : baseConditions;
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingsTable)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const baseQuery = db
    .select({
      id: listingsTable.id,
      listingNumber: listingsTable.listingNumber,
      title: listingsTable.title,
      description: listingsTable.description,
      pricePerDay: listingsTable.pricePerDay,
      deposit: listingsTable.deposit,
      itemCategory: listingsTable.itemCategory,
      maxProtectionLimit: listingsTable.maxProtectionLimit,
      requiresManualVerification: listingsTable.requiresManualVerification,
      ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
      categoryId: listingsTable.categoryId,
      categoryName: categoriesTable.name,
      categorySlug: categoriesTable.slug,
      regionId: listingsTable.regionId,
      regionName: regionsTable.name,
      regionSlug: regionsTable.slug,
      city: listingsTable.city,
      lat: listingsTable.lat,
      lng: listingsTable.lng,
      meetingAddress: listingsTable.meetingAddress,
      photos: listingsTable.photos,
      isAvailable: listingsTable.isAvailable,
      ownerId: listingsTable.ownerId,
      ownerName: usersTable.name,
      ownerAvatar: usersTable.avatar,
      ownerPhone: usersTable.phone,
      // Stage 19g — для бейджа «Проверенный владелец» в карточке объявления.
      ownerIsVerified: usersTable.isVerified,
      ownerTrustScore: usersTable.trustScore,
      ownerCompletedDealsCount: usersTable.completedDealsCount,
      ownerRole: usersTable.role,
      isFeatured: listingsTable.isFeatured,
      featuredUntil: listingsTable.featuredUntil,
      isUrgent: listingsTable.isUrgent,
      urgentUntil: listingsTable.urgentUntil,
      boostedUntil: listingsTable.boostedUntil,
      // Stage 19e: денормализованные счётчики — берём прямо из таблицы, без N+1
      bookingCount: listingsTable.bookingCount,
      reviewCount: listingsTable.reviewCount,
      avgRating: listingsTable.avgRating,
      favoritesCount: listingsTable.favoritesCount,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(whereClause);

  // Платное продвижение должно работать во ВСЕХ выдачах, не только в дефолтной.
  // Эти три SQL-условия префиксуются перед любой пользовательской сортировкой, чтобы
  // оплаченные VIP/Срочно/Boost всегда стояли в топе своих групп.
  const promoOrder = [
    sql`(${listingsTable.isFeatured} = true AND ${listingsTable.featuredUntil} > NOW()) DESC`,
    sql`(${listingsTable.isUrgent} = true AND ${listingsTable.urgentUntil} > NOW()) DESC`,
    sql`(${listingsTable.boostedUntil} IS NOT NULL AND ${listingsTable.boostedUntil} > NOW()) DESC`,
  ];

  // Stage 19e: всё SQL — больше нет JS-сортировки и N+1 sub-queries.
  // popular/rating используют денормализованные колонки.
  let rawListings;
  if (sort === "price_asc") {
    rawListings = await (baseQuery as any)
      .orderBy(...promoOrder, sql`${listingsTable.pricePerDay}::numeric ASC`)
      .limit(limitNum).offset(offset);
  } else if (sort === "price_desc") {
    rawListings = await (baseQuery as any)
      .orderBy(...promoOrder, sql`${listingsTable.pricePerDay}::numeric DESC`)
      .limit(limitNum).offset(offset);
  } else if (sort === "protected_first") {
    // Premium-объявления всегда выше Free, внутри группы — оплаченное продвижение, затем по дате
    rawListings = await (baseQuery as any)
      .orderBy(sql`${listingsTable.ownerProtectionEnabled} DESC`, ...promoOrder, desc(listingsTable.createdAt))
      .limit(limitNum).offset(offset);
  } else if (sort === "new") {
    // Новинки: оплаченное продвижение → дата создания
    rawListings = await (baseQuery as any)
      .orderBy(...promoOrder, desc(listingsTable.createdAt))
      .limit(limitNum).offset(offset);
  } else if (sort === "rating") {
    // По рейтингу: промо → средний рейтинг → кол-во отзывов → дата
    rawListings = await (baseQuery as any)
      .orderBy(
        ...promoOrder,
        desc(listingsTable.avgRating),
        desc(listingsTable.reviewCount),
        desc(listingsTable.createdAt),
      )
      .limit(limitNum).offset(offset);
  } else if (sort === "popular") {
    // Stage 19c — Популярные: промо → гибридный «hit-score» → дата.
    //   hit_score = bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d
    // Просмотры за 30 дней считаются через коррелированный subquery
    // (UNIQUE-индекс по часу-бакету защищает от накрутки).
    rawListings = await (baseQuery as any)
      .orderBy(
        ...promoOrder,
        sql`(
          ${listingsTable.bookingCount} * 5
          + ${listingsTable.reviewCount} * 2
          + ${listingsTable.favoritesCount}
          + COALESCE((
              SELECT COUNT(*) FROM listing_views lv
              WHERE lv.listing_id = ${listingsTable.id}
                AND lv.created_at > NOW() - INTERVAL '30 days'
            ), 0)
        ) DESC`,
        desc(listingsTable.createdAt),
      )
      .limit(limitNum).offset(offset);
  } else {
    // Дефолт: VIP (активные) → Срочно (активные) → boosted (активные, поднятие на 24ч) → новые
    // GREATEST(boostedUntil, createdAt) даёт «эффективную дату»: только если boost ещё не истёк.
    rawListings = await (baseQuery as any)
      .orderBy(
        ...promoOrder,
        sql`GREATEST(COALESCE(CASE WHEN ${listingsTable.boostedUntil} > NOW() THEN ${listingsTable.boostedUntil} END, ${listingsTable.createdAt}), ${listingsTable.createdAt}) DESC`,
      )
      .limit(limitNum).offset(offset);
  }

  // Stage 19e: enrichment теперь чисто формат — никаких доп. запросов в БД.
  const sortedListings = rawListings.map((l: any) => ({
    ...l,
    pricePerDay: parseFloat(l.pricePerDay as unknown as string),
    deposit: l.deposit ? parseFloat(l.deposit as unknown as string) : undefined,
    createdAt: l.createdAt.toISOString(),
    rating: l.avgRating ? parseFloat(l.avgRating as unknown as string) : 0,
    reviewCount: l.reviewCount ?? 0,
    bookingCount: l.bookingCount ?? 0,
    favoritesCount: l.favoritesCount ?? 0,
  }));

  // Fallback: если выбран регион и в нём ничего не найдено — выдаём объявления из других регионов
  // (как на Авито: "В вашем регионе ничего не найдено, но смотрите похожие в других регионах")
  let otherRegionsListings: any[] | undefined;
  if (resolvedRegionId !== null && total === 0) {
    const otherRegionsRaw = await db
      .select({
        id: listingsTable.id,
        listingNumber: listingsTable.listingNumber,
        title: listingsTable.title,
        description: listingsTable.description,
        pricePerDay: listingsTable.pricePerDay,
        deposit: listingsTable.deposit,
        itemCategory: listingsTable.itemCategory,
        maxProtectionLimit: listingsTable.maxProtectionLimit,
        requiresManualVerification: listingsTable.requiresManualVerification,
        ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
        categoryId: listingsTable.categoryId,
        categoryName: categoriesTable.name,
        regionId: listingsTable.regionId,
        regionName: regionsTable.name,
        city: listingsTable.city,
        lat: listingsTable.lat,
        lng: listingsTable.lng,
        meetingAddress: listingsTable.meetingAddress,
        photos: listingsTable.photos,
        isAvailable: listingsTable.isAvailable,
        ownerId: listingsTable.ownerId,
        ownerName: usersTable.name,
        ownerAvatar: usersTable.avatar,
        ownerPhone: usersTable.phone,
        // Stage 19g — для бейджа «Проверенный владелец» (fallback из других регионов).
        ownerIsVerified: usersTable.isVerified,
        ownerTrustScore: usersTable.trustScore,
        ownerCompletedDealsCount: usersTable.completedDealsCount,
        ownerRole: usersTable.role,
        bookingCount: listingsTable.bookingCount,
        reviewCount: listingsTable.reviewCount,
        avgRating: listingsTable.avgRating,
        favoritesCount: listingsTable.favoritesCount,
        createdAt: listingsTable.createdAt,
      })
      .from(listingsTable)
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
      .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
      .where(and(...baseConditions))
      .orderBy(desc(listingsTable.createdAt))
      .limit(12);

    otherRegionsListings = otherRegionsRaw.map((l: any) => ({
      ...l,
      pricePerDay: parseFloat(l.pricePerDay as unknown as string),
      deposit: l.deposit ? parseFloat(l.deposit as unknown as string) : undefined,
      createdAt: l.createdAt.toISOString(),
      rating: l.avgRating ? parseFloat(l.avgRating as unknown as string) : 0,
      reviewCount: l.reviewCount ?? 0,
      bookingCount: l.bookingCount ?? 0,
      favoritesCount: l.favoritesCount ?? 0,
    }));
  }

  res.json({
    listings: sortedListings,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    ...(otherRegionsListings && otherRegionsListings.length > 0 ? { otherRegionsListings } : {}),
  });
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const {
    title, description, pricePerDay, categoryId, regionId,
    city, lat, lng, meetingAddress, photos,
    itemCategory, ownerProtectionEnabled, deposit, isAvailable,
  } = parsed.data as typeof parsed.data & {
    city?: string; lat?: number; lng?: number; meetingAddress?: string;
    itemCategory?: "" | "electronics" | "tools" | "leisure" | "special_machinery";
    ownerProtectionEnabled?: boolean;
    deposit?: number;
  };

  const cfg = await getPlatformSettings();
  const isFree = ownerProtectionEnabled === false;

  // ── Проверки Free-тарифа ────────────────────────────────────────────────
  if (isFree) {
    // 1. Глобальный переключатель
    if (!cfg.freeListingsEnabled) {
      res.status(403).json({ error: "free_disabled", message: "Бесплатные объявления временно отключены администратором" });
      return;
    }

    // 2. Лимит активных Free-объявлений на одного владельца
    const [{ activeCount }] = await db
      .select({ activeCount: count() })
      .from(listingsTable)
      .where(and(
        eq(listingsTable.ownerId, req.userId!),
        eq(listingsTable.ownerProtectionEnabled, false),
        eq(listingsTable.isAvailable, true),
      ));
    if (activeCount >= cfg.freeListingsMaxPerOwner) {
      res.status(422).json({
        error: "free_limit_reached",
        message: `Лимит бесплатных объявлений: не более ${cfg.freeListingsMaxPerOwner} активных`,
      });
      return;
    }

    // 3. Требование верифицированного телефона
    if (cfg.freeListingsRequirePhone) {
      const [ownerRow] = await db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (!ownerRow?.phone) {
        res.status(422).json({
          error: "phone_required",
          message: "Для бесплатного объявления укажите телефон в профиле — арендаторы свяжутся напрямую",
        });
        return;
      }
    }
  }

  // Залог: сохраняем только при прямой аренде (ownerProtectionEnabled === false).
  // При безопасной сделке депозит рассчитывается автоматически в bookings из настроек платформы.
  const depositToSave =
    isFree && typeof deposit === "number" && deposit > 0
      ? deposit.toFixed(2)
      : null;

  // Загружаем кол-во завершённых сделок владельца для расчёта кепа фонда
  const [owner] = await db.select({ completedDealsCount: usersTable.completedDealsCount })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const completedDeals = owner?.completedDealsCount ?? 0;

  const maxProtectionLimit = await calcMaxProtection(pricePerDay, itemCategory ?? null, completedDeals);

  // Детектор аномальной цены (>3× от среднего по категории)
  const categoryAvg: Record<string, number> = { electronics: 2500, tools: 1000, leisure: 500, special_machinery: 5000 };
  const avg = categoryAvg[itemCategory ?? "tools"] ?? 1000;
  const requiresManualVerification = pricePerDay > avg * 3;

  const [listing] = await db.insert(listingsTable).values({
    title,
    description: description ?? null,
    pricePerDay: pricePerDay.toString(),
    categoryId,
    itemCategory: itemCategory ?? null,
    maxProtectionLimit,
    requiresManualVerification,
    regionId,
    city: city ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    meetingAddress: meetingAddress ?? null,
    ownerId: req.userId!,
    photos: photos ?? [],
    ownerProtectionEnabled: ownerProtectionEnabled !== false,
    deposit: depositToSave,
    isAvailable: isAvailable ?? true,
  }).returning();

  // Assign listing number
  const listingNumber = generateListingNumber(listing.id);
  await db.update(listingsTable).set({ listingNumber }).where(eq(listingsTable.id, listing.id));

  const full = await getListingWithDetails(listing.id);
  res.status(201).json({
    ...full,
    pricePerDay: parseFloat(full!.pricePerDay as unknown as string),
    deposit: full!.deposit ? parseFloat(full!.deposit as unknown as string) : undefined,
    createdAt: full!.createdAt.toISOString(),
  });
});

// GET /cities?q=... — distinct city names from listings for autocomplete
router.get("/cities", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }
  const rows = await db
    .selectDistinct({ city: listingsTable.city })
    .from(listingsTable)
    .where(and(isNotNull(listingsTable.city), ilike(listingsTable.city, `%${q}%`)))
    .limit(8);
  const cities = rows.map(r => r.city).filter(Boolean) as string[];
  cities.sort((a, b) => {
    const aq = a.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
    const bq = b.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
    return aq - bq || a.localeCompare(b, "ru");
  });
  res.json(cities);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Неверный ID" });
    return;
  }

  const listing = await getListingWithDetails(id);
  if (!listing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      listingId: reviewsTable.listingId,
      authorId: reviewsTable.authorId,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(eq(reviewsTable.listingId, id))
    .orderBy(reviewsTable.createdAt);

  // Телефон владельца Free-объявления: скрываем если режим «after_payment»
  // (арендатор должен купить доступ через /contacts/unlock, там и получит номер).
  const listingSettings = await getPlatformSettings();
  const isFreeDetail = listing.ownerProtectionEnabled === false;
  const maskPhone = isFreeDetail && listingSettings.freeShowOwnerPhoneMode === "after_payment";

  // Stage 19c — фиксируем просмотр (best-effort, не блокирует ответ)
  void trackListingView(id, req);

  res.json({
    ...listing,
    ownerPhone: maskPhone ? null : listing.ownerPhone,
    pricePerDay: parseFloat(listing.pricePerDay as unknown as string),
    deposit: listing.deposit ? parseFloat(listing.deposit as unknown as string) : undefined,
    createdAt: listing.createdAt.toISOString(),
    // Stage 19e: денормализованные счётчики из колонок listings — никаких extra-запросов
    rating: listing.avgRating ? parseFloat(listing.avgRating as unknown as string) : 0,
    reviewCount: listing.reviewCount ?? 0,
    bookingCount: listing.bookingCount ?? 0,
    favoritesCount: listing.favoritesCount ?? 0,
    views30d: listing.views30d ?? 0,
    reviews: reviews.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      authorAvatar: r.authorAvatar ?? undefined,
      text: r.text ?? undefined,
    })),
  });
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  if (existing.ownerId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const { title, description, pricePerDay, categoryId, regionId, city, lat, lng, meetingAddress, photos, itemCategory, ownerProtectionEnabled: ownerProt, deposit, isAvailable, status } = req.body;

  // Логика залога:
  //   • Защищённая сделка (Premium): залог рассчитывается из настроек фонда → сбрасываем ручной в null.
  //   • Бесплатное объявление (Free): залог опциональный, владелец сам выбирает — указать или нет.
  const effectiveProtection = ownerProt !== undefined ? ownerProt : existing.ownerProtectionEnabled;

  let depositUpdate: string | null | undefined;
  if (effectiveProtection === false) {
    // Free-тариф: принимаем любое неотрицательное число; 0/undefined = без залога.
    if (typeof deposit === "number" && deposit > 0) {
      depositUpdate = deposit.toFixed(2);
    } else if (deposit === 0 || deposit === null) {
      depositUpdate = null;
    }
    // если deposit === undefined и владелец не трогал поле — оставляем как было
  } else if (ownerProt === true) {
    // Включение защищённой сделки — обнуляем ручной залог.
    depositUpdate = null;
  }

  if (photos !== undefined && Array.isArray(existing.photos)) {
    const removed = (existing.photos as string[]).filter(p => !photos.includes(p));
    deleteUploadedFiles(removed);
  }

  // Пересчитываем лимит фонда при изменении цены или категории
  let newMaxProtection: number | undefined;
  if (pricePerDay !== undefined || itemCategory !== undefined) {
    const [owner] = await db.select({ completedDealsCount: usersTable.completedDealsCount })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const completedDeals = owner?.completedDealsCount ?? 0;
    const ppd = pricePerDay ?? parseFloat(existing.pricePerDay as unknown as string);
    const cat = itemCategory ?? existing.itemCategory;
    newMaxProtection = await calcMaxProtection(ppd, cat, completedDeals);
  }

  const categoryAvg: Record<string, number> = { electronics: 2500, tools: 1000, leisure: 500, special_machinery: 5000 };
  const ppd = pricePerDay ?? parseFloat(existing.pricePerDay as unknown as string);
  const cat = itemCategory ?? existing.itemCategory ?? "tools";
  const newRequiresVerification = ppd > (categoryAvg[cat] ?? 1000) * 3;

  await db.update(listingsTable).set({
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(pricePerDay !== undefined && { pricePerDay: pricePerDay.toString() }),
    ...(categoryId && { categoryId }),
    ...(itemCategory !== undefined && { itemCategory }),
    ...(newMaxProtection !== undefined && { maxProtectionLimit: newMaxProtection }),
    requiresManualVerification: newRequiresVerification,
    ...(regionId && { regionId }),
    ...(city !== undefined && { city: city || null }),
    ...(lat !== undefined && { lat: lat ?? null }),
    ...(lng !== undefined && { lng: lng ?? null }),
    ...(meetingAddress !== undefined && { meetingAddress: meetingAddress || null }),
    ...(photos !== undefined && { photos }),
    ...(ownerProt !== undefined && { ownerProtectionEnabled: ownerProt }),
    ...(depositUpdate !== undefined && { deposit: depositUpdate }),
    ...(isAvailable !== undefined && { isAvailable }),
    ...(status !== undefined && req.userRole === "admin" && { status }),
  }).where(eq(listingsTable.id, id));

  const updated = await getListingWithDetails(id);
  res.json({
    ...updated,
    pricePerDay: parseFloat(updated!.pricePerDay as unknown as string),
    deposit: updated!.deposit ? parseFloat(updated!.deposit as unknown as string) : undefined,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  if (existing.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  deleteUploadedFiles(existing.photos ?? []);
  await db.delete(listingsTable).where(eq(listingsTable.id, id));
  res.json({ success: true, message: "Объявление удалено" });
});

router.get("/:id/unavailable-dates", async (req, res) => {
  const id = parseInt(req.params.id as string);

  const bookings = await db
    .select({
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.listingId, id),
        sql`${bookingsTable.status} IN ('pending', 'confirmed')`
      )
    );

  res.json(bookings);
});

router.get("/:id/reviews", async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

  const rows = await db
    .select({
      id: reviewsTable.id,
      reviewType: reviewsTable.reviewType,
      reviewerRole: reviewsTable.reviewerRole,
      listingId: reviewsTable.listingId,
      bookingId: reviewsTable.bookingId,
      bookingNumber: reviewsTable.bookingNumber,
      authorId: reviewsTable.authorId,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
      revieweeId: reviewsTable.revieweeId,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      responseText: reviewsTable.responseText,
      responseAt: reviewsTable.responseAt,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(and(eq(reviewsTable.listingId, id), eq(reviewsTable.reviewType, "listing")))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  res.json(rows.map(r => ({
    id: r.id,
    reviewType: r.reviewType,
    reviewerRole: r.reviewerRole,
    listingId: r.listingId ?? undefined,
    bookingId: r.bookingId ?? undefined,
    bookingNumber: r.bookingNumber ?? undefined,
    authorId: r.authorId,
    authorName: r.authorName ?? "Пользователь",
    authorAvatar: r.authorAvatar ?? undefined,
    revieweeId: r.revieweeId ?? undefined,
    rating: r.rating,
    text: r.text ?? undefined,
    responseText: r.responseText ?? undefined,
    responseAt: r.responseAt ? r.responseAt.toISOString() : undefined,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
