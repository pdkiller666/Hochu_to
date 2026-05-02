import { Layout } from "@/components/layout/Layout";
import { useRoute } from "wouter";
import { useGetListingById, useGetListingUnavailableDates, useCreateBooking, useGetCurrentUser } from "@workspace/api-client-react";
import { Loader2, MapPin, Star, Shield, ShieldOff, ShieldCheck, Info, User, ChevronLeft, CheckCircle2, AlertTriangle, Settings, CalendarDays, X, Expand, Hash, MessageSquare, Phone, Heart, Crown, Zap, Sparkles, Flame, Award } from "lucide-react";
import { formatPrice, calculateTotalPrice, calcDeposit, calcMaxProtectionLimit, type ItemCategory } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useAuthState, getToken } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useDocumentMeta } from "@/lib/use-document-meta";
import { useFavorites } from "@/lib/favorites-context";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";
import { BookingCalendar, BookedRange } from "@/components/BookingCalendar";
import { Lightbox } from "@/components/ui/Lightbox";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";
import { ReviewCard, ReviewData } from "@/components/ui/ReviewCard";
import { StarRating, RatingDisplay } from "@/components/ui/StarRating";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { ListingMap } from "@/components/ui/ListingMap";
import { CollapsibleMap } from "@/components/ui/CollapsibleMap";
import { ContactPurchaseModal } from "@/components/ui/ContactPurchaseModal";
import { usePublicSettings } from "@/lib/use-public-settings";
import PromoteListingModal from "@/components/PromoteListingModal";

type ListingBadge = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className: string;
};

function getDetailBadges(l: any, isCommercialMode: boolean): ListingBadge[] {
  const out: ListingBadge[] = [];
  const now = Date.now();
  // В Бета-режиме платных продвижений нет, бейджи скрываем.
  if (isCommercialMode && l.isFeatured && (!l.featuredUntil || new Date(l.featuredUntil).getTime() > now)) {
    out.push({ key: "vip", icon: Crown, label: "VIP", className: "bg-amber-100 text-amber-800 border-amber-300" });
  }
  if (isCommercialMode && l.isUrgent && (!l.urgentUntil || new Date(l.urgentUntil).getTime() > now)) {
    out.push({ key: "urgent", icon: Zap, label: "Срочно", className: "bg-red-100 text-red-700 border-red-300" });
  }
  if (isCommercialMode && l.boostedUntil && new Date(l.boostedUntil).getTime() > now) {
    out.push({ key: "boost", icon: Sparkles, label: "Топ", className: "bg-orange-100 text-orange-800 border-orange-300" });
  }
  const bookingCount = typeof l.bookingCount === "number" ? l.bookingCount : 0;
  const rating = typeof l.rating === "number" ? l.rating : 0;
  if (bookingCount >= 10 && rating < 4.5) {
    out.push({ key: "popular", icon: Flame, label: "Часто берут", className: "bg-orange-50 text-orange-700 border-orange-200" });
  }
  // Stage 19g — Trust & Verification: бейдж «Проверенный владелец». Поле ownerIsVerified
  // приходит из JOIN с usersTable (см. routes/listings.ts). Парный с ListingCard.
  if (l.ownerIsVerified) {
    out.push({ key: "verified-owner", icon: Award, label: "Проверенный владелец", className: "bg-violet-50 text-violet-700 border-violet-200" });
  }
  return out;
}

function BadgeRow({ badges }: { badges: ListingBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {badges.map(b => {
        const Icon = b.icon;
        return (
          <span key={b.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${b.className}`}>
            <Icon className="w-3 h-3" /> {b.label}
          </span>
        );
      })}
    </div>
  );
}

// Stage 32.1 — цветовая шкала Trust Score
const getTrustScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-stone-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-stone-500";
  return "text-amber-600";
};

export default function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const id = Number(params?.id);
  const { isAuthenticated, token } = useAuthState();
  const API_BASE = import.meta.env.VITE_API_URL ?? "";

  const { data: listing, isLoading, error } = useGetListingById(id);
  const { data: unavailableDates } = useGetListingUnavailableDates(id);

  useDocumentMeta(
    listing
      ? {
          title: listing.title,
          description: `Аренда: ${listing.title}${listing.city ? ` в ${listing.city}` : ""}. ${listing.pricePerDay ? `От ${listing.pricePerDay} ₽/сутки.` : ""} Безопасная сделка с гарантийным фондом ХочуТо.`,
          image: listing.photos?.[0] ? listing.photos[0] : undefined,
        }
      : { title: "Объявление" }
  );

  const { data: currentUser } = useGetCurrentUser(
    { request: { headers: { Authorization: `Bearer ${token}` } } },
    { query: { enabled: !!token } }
  );

  const createBooking = useCreateBooking({
    request: { headers: { Authorization: `Bearer ${token}` } }
  });

  const isOwnerRole = isAuthenticated && currentUser?.role === "owner";

  const { isFavorite, toggle: toggleFav } = useFavorites();
  const [, navigate] = useLocation();
  const fav = isFavorite(id);
  const handleFavoriteClick = () => {
    if (!getToken()) { navigate("/auth"); return; }
    toggleFav(id);
  };

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [renterFundEnabled, setRenterFundEnabled] = useState(true);
  const [showConsequenceModal, setShowConsequenceModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mainImgError, setMainImgError] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [showFreeUpgradeDetails, setShowFreeUpgradeDetails] = useState(false);
  const publicSettings = usePublicSettings();
  const contactPriceSingle = publicSettings?.contactPriceSingle ?? 0;
  // Tri-state semantics:
  //   • settings ещё не загружены → ведём себя как commercial (это безопасный
  //     дефолт, чтобы не скрывать коммерческие фичи на миллисекунды загрузки).
  //   • isBetaMode === true ТОЛЬКО когда сервер явно вернул is_commercial_mode=false.
  //   • isCommercialMode = !isBetaMode (включает loading-фазу).
  const isBetaMode = publicSettings?.isCommercialMode === false;
  const isCommercialMode = !isBetaMode;

  // Free-объявление: владелец отключил Гарантийный фонд. По умолчанию арендатор идёт по «Прямому расчёту».
  const isFreeListing = (listing as any)?.ownerProtectionEnabled === false;
  // Re-init при смене listing ИЛИ при загрузке settings (publicSettings).
  // Раньше одноразовый флаг фиксировал состояние до загрузки настроек, что
  // могло оставить free-листинг в beta с CTA «Получить контакты (N₽)».
  useEffect(() => {
    if (!listing || !publicSettings) return;
    if (isBetaMode) {
      // Бета-режим: коммерция выключена, ветка «Получить контакты за N₽» спрятана.
      // Используем «защищённую» ветку как контейнер обычной заявки на бронирование,
      // но без фонда — чекбокс защиты в чекауте тоже скрыт.
      setProtectionEnabled(true);
      setRenterFundEnabled(false);
    } else if (isFreeListing) {
      // На Free-объявлении: по умолчанию «Прямой расчёт» (без бронирования)
      // и фонд арендатора выключен (если арендатор апгрейдит — пусть включит сам)
      setProtectionEnabled(false);
      setRenterFundEnabled(false);
    } else {
      // Premium: фонд по умолчанию включён, чтобы защитить арендатора
      setProtectionEnabled(true);
      setRenterFundEnabled(true);
    }
  }, [listing, isFreeListing, isBetaMode, publicSettings]);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [canReview, setCanReview] = useState<{ canReviewListing: boolean; bookingNumber?: string; bookingId?: number } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, [id]);

  const fetchCanReview = useCallback(async () => {
    if (!token) return;
    // Find any completed bookings for this listing by the current user
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const bookings: any[] = Array.isArray(data) ? data : [];
      const completed = bookings.find(b => b.listingId === id && b.status === "completed");
      if (!completed) return;
      const cr = await fetch(`${API_BASE}/api/reviews/can-review/${completed.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (cr.ok) {
        const data = await cr.json();
        setCanReview({ ...data, bookingId: completed.id });
      }
    } catch {}
  }, [id, token]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  useEffect(() => { if (token) fetchCanReview(); }, [fetchCanReview, token]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReview?.bookingId || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: canReview.bookingId, reviewType: "listing", rating: reviewRating, text: reviewText.trim() || undefined }),
      });
      if (res.ok) {
        setReviewSuccess(true);
        setCanReview(prev => prev ? { ...prev, canReviewListing: false } : null);
        fetchReviews();
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRespond = async (reviewId: number, text: string) => {
    await fetch(`${API_BASE}/api/reviews/${reviewId}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
  };

  // avg rating from loaded reviews
  const avgRating = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : (listing?.rating ?? 0);
  const reviewCount = reviews.length || (listing?.reviewCount ?? 0);

  // Cast API response to BookedRange[]
  const bookedRanges: BookedRange[] = (unavailableDates ?? []).map(d => ({
    startDate: d.startDate,
    endDate: d.endDate,
    status: (d.status === "confirmed" ? "confirmed" : "pending") as "confirmed" | "pending",
  }));

  // Two-click calendar selection logic
  const handleDateSelect = (date: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start fresh selection
      setStartDate(date);
      setEndDate("");
    } else {
      // startDate is set, endDate is not
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else if (date === startDate) {
        setStartDate("");
      } else {
        setEndDate(date);
      }
    }
  };

  const totalDays = startDate && endDate
    ? Math.max(1, differenceInCalendarDays(parseISO(endDate), parseISO(startDate)))
    : 0;

  const getPhotoSrc = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;

  const photos = listing?.photos?.filter(Boolean) ?? [];

  const openLightbox = (i: number) => { setLightboxIndex(i); setLightboxOpen(true); };

  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setBookingError(null);
    createBooking.mutate({
      data: {
        listingId: id,
        startDate,
        endDate,
        message: message || undefined,
        protectionEnabled,
        renterProtectionEnabled: renterFundEnabled,
      }
    }, {
      onSuccess: () => setBookingSuccess(true),
      onError: (err: any) => {
        const serverMsg =
          err?.data?.message ??
          err?.response?.data?.message ??
          err?.message ??
          "Не удалось отправить заявку. Попробуйте ещё раз.";
        setBookingError(String(serverMsg));
      },
    });
  };

  if (isLoading) return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (error || !listing) return (
    <Layout>
      <div className="max-w-3xl mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Вещь не найдена</h1>
        <Link href="/catalog" className="btn-primary">Вернуться в каталог</Link>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="bg-card border-b border-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/catalog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Вернуться в каталог
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content: Photos + Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title mobile (visible on small, hidden on lg) */}
            <div className="lg:hidden mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary mb-2">
                <span className="px-3 py-1 bg-primary/10 rounded-full">{listing.categoryName}</span>
                {(listing as any).listingNumber && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono bg-muted/80 border border-border/50 rounded-lg px-2 py-0.5 tracking-wide font-normal">
                    <Hash className="w-3 h-3" />{(listing as any).listingNumber}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-3xl font-bold">{listing.title}</h1>
                <button
                  onClick={handleFavoriteClick}
                  className={`shrink-0 mt-1 w-10 h-10 rounded-full flex items-center justify-center transition-all border ${
                    fav
                      ? "text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100"
                      : "text-muted-foreground border-border bg-muted/60 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50"
                  }`}
                  title={fav ? "Удалить из избранного" : "Добавить в избранное"}
                >
                  <Heart className={`w-5 h-5 ${fav ? "fill-current" : ""}`} />
                </button>
              </div>
              <div className="mt-3">
                <BadgeRow badges={getDetailBadges(listing, isCommercialMode)} />
              </div>
            </div>

            {/* Photo Gallery */}
            <div className="space-y-2">
              {/* Main photo */}
              <div
                className={`relative aspect-[4/3] lg:aspect-[16/10] lg:max-h-[420px] mx-auto w-full rounded-3xl overflow-hidden bg-muted border border-border shadow-sm group ${photos.length > 0 && !mainImgError ? "cursor-zoom-in" : ""}`}
                onClick={() => photos.length > 0 && !mainImgError && openLightbox(0)}
              >
                {photos.length > 0 && !mainImgError ? (
                  <>
                    <img
                      src={getPhotoSrc(photos[0])}
                      alt={listing.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={() => setMainImgError(true)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Expand className="w-5 h-5" />
                      </div>
                    </div>
                    {photos.length > 1 && (
                      <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        1 / {photos.length}
                      </span>
                    )}
                  </>
                ) : (
                  <ListingPlaceholder categoryName={listing.categoryName ?? undefined} className="rounded-3xl" />
                )}
              </div>

              {/* Thumbnails */}
              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(1, 5).map((url, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border cursor-pointer group"
                      onClick={() => openLightbox(i + 1)}
                    >
                      <img
                        src={getPhotoSrc(url)}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={e => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/200x200?text=Фото"; }}
                      />
                      {i === 3 && photos.length > 5 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">+{photos.length - 5}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lightbox */}
            {lightboxOpen && (
              <Lightbox
                photos={photos}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
              />
            )}

            {/* Title Desktop */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                <span className="px-3 py-1 bg-primary/10 rounded-full">{listing.categoryName}</span>
                {(listing as any).listingNumber && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono bg-muted/80 border border-border/50 rounded-lg px-2 py-0.5 tracking-wide font-normal">
                    <Hash className="w-3 h-3" />{(listing as any).listingNumber}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-4xl font-bold">{listing.title}</h1>
                <button
                  onClick={handleFavoriteClick}
                  className={`shrink-0 mt-1 w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
                    fav
                      ? "text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100"
                      : "text-muted-foreground border-border bg-muted/60 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50"
                  }`}
                  title={fav ? "Удалить из избранного" : "Добавить в избранное"}
                >
                  <Heart className={`w-5 h-5 ${fav ? "fill-current" : ""}`} />
                </button>
              </div>
              <BadgeRow badges={getDetailBadges(listing, isCommercialMode)} />

              <div className="flex items-center gap-6 text-sm text-muted-foreground pb-6 border-b border-border">
                <div
                  className="flex items-center gap-1.5 font-medium text-foreground bg-amber-50 text-amber-700 px-3 py-1 rounded-lg cursor-help"
                  title="Только проверенные отзывы. Оставить отзыв можно лишь после завершённой сделки через платформу — поэтому накрутка невозможна."
                >
                  <Star className="w-4 h-4 fill-current" />
                  {avgRating > 0 ? `${avgRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "отзыв" : reviewCount < 5 ? "отзыва" : "отзывов"})` : "Нет отзывов"}
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" aria-label="Проверенные отзывы" />
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    {(listing as any).city
                      ? `${(listing as any).city}, ${listing.regionName}`
                      : listing.regionName}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <section>
              <h3 className="text-2xl font-bold mb-4">Описание</h3>
              <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
                {listing.description || "Владелец не добавил описание."}
              </p>
            </section>

            {/* Location Map */}
            {((listing as any).city || listing.regionName) && (
              <section>
                <h3 className="text-2xl font-bold mb-3">Местонахождение</h3>
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground">
                    {(listing as any).city
                      ? `${(listing as any).city}, ${listing.regionName}`
                      : listing.regionName}
                  </span>
                </div>
                <CollapsibleMap
                  label={(listing as any).lat && (listing as any).lng ? "Точка на карте" : "Карта местонахождения"}
                  hint="Нажмите, чтобы посмотреть, где находится вещь"
                  defaultOpen={false}
                >
                  <ListingMap
                    city={(listing as any).city}
                    regionName={listing.regionName}
                    lat={(listing as any).lat}
                    lng={(listing as any).lng}
                  />
                </CollapsibleMap>
                {(listing as any).meetingAddress && (
                  <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">Место передачи вещи</p>
                      <p className="text-sm text-amber-900">{(listing as any).meetingAddress}</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Owner Info */}
            <Link href={`/users/${listing.ownerId}`}>
              <section className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center gap-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-2xl font-bold text-secondary-foreground overflow-hidden shrink-0">
                  {listing.ownerAvatar ? (
                    <img src={listing.ownerAvatar.startsWith("http") ? listing.ownerAvatar : `${import.meta.env.VITE_API_URL ?? ""}${listing.ownerAvatar}`} alt={listing.ownerName} className="w-full h-full object-cover" />
                  ) : (
                    listing.ownerName?.charAt(0).toUpperCase() || <User />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Владелец</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{listing.ownerName || "Владелец"}</h4>
                    {/* Stage 29 — Trust Score владельца */}
                    <TrustBadge score={(listing as any).ownerTrustScore} size="sm" />
                  </div>
                  {/* Stage 32.1 — публичный Trust Score с цветом и счётчиком сделок */}
                  <div className="flex items-center gap-1 text-sm text-stone-600 mt-1">
                    <ShieldCheck className={`w-4 h-4 ${getTrustScoreColor((listing as any).ownerTrustScore)}`} />
                    <span>Доверие: {(listing as any).ownerTrustScore !== null && (listing as any).ownerTrustScore !== undefined ? `${(listing as any).ownerTrustScore}%` : "Нет данных"}</span>
                    <span className="mx-1">•</span>
                    <span>Сделок: {(listing as any).ownerCompletedDealsCount || 0}</span>
                  </div>
                </div>
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </div>
              </section>
            </Link>
            {/* Reviews Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">Отзывы</h3>
                  {reviewCount > 0 && (
                    <div className="flex items-center gap-2">
                      <StarRating value={Math.round(avgRating)} size="sm" />
                      <span className="font-semibold text-lg">{avgRating.toFixed(1)}</span>
                      <span className="text-muted-foreground text-sm">({reviewCount})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Review form for eligible renters */}
              {canReview?.canReviewListing && !reviewSuccess && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Оставьте отзыв
                  </h4>
                  {canReview.bookingNumber && (
                    <p className="text-xs text-amber-700 mb-4">
                      По бронированию <span className="font-mono">{canReview.bookingNumber}</span>
                    </p>
                  )}
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-amber-800">Ваша оценка *</label>
                      <StarRating
                        value={reviewRating}
                        size="lg"
                        interactive
                        hovered={reviewHover}
                        onChange={setReviewRating}
                        onHover={setReviewHover}
                        onLeave={() => setReviewHover(0)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-amber-800">Ваш отзыв (необязательно)</label>
                      <textarea
                        className="input-field text-sm min-h-[80px] resize-none"
                        placeholder="Расскажите о вашем опыте аренды этой вещи..."
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        maxLength={1000}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={reviewSubmitting || reviewRating === 0}
                      className="btn-primary px-6 py-2.5"
                    >
                      {reviewSubmitting ? "Публикация…" : "Опубликовать отзыв"}
                    </button>
                  </form>
                </div>
              )}

              {reviewSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-green-800 font-medium">Ваш отзыв опубликован. Спасибо!</span>
                </div>
              )}

              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      currentUserId={currentUser?.id}
                      onRespond={handleRespond}
                      apiBase={API_BASE}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white border border-border rounded-2xl">
                  <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground">Пока нет отзывов. Станьте первым!</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar: Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 glass-panel p-6 rounded-3xl">
              <div className="mb-6 pb-6 border-b border-border">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-display font-black text-primary">{formatPrice(listing.pricePerDay)}</span>
                  <span className="text-muted-foreground pb-1">/ сутки</span>
                </div>
                {isOwnerRole && currentUser?.id === (listing as any).ownerId && (() => {
                  const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
                  const ownerProt = (listing as any).ownerProtectionEnabled !== false;
                  const { ownerPayout } = calculateTotalPrice(listing.pricePerDay, cat, 1, ownerProt, false);
                  return (
                    <>
                      {isCommercialMode && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 mb-2 text-xs">
                          <p className="text-green-800">
                            На карту: <strong className="text-green-900 text-sm">{formatPrice(ownerPayout)}</strong> с суток <span className="text-green-700">— чистыми</span>
                          </p>
                          <p className="text-[10.5px] text-green-700 leading-snug mt-1">
                            {ownerProt
                              ? "Эквайринг, чек, эскроу и поддержку при споре платформа берёт на себя — вы получаете готовую сумму без хлопот."
                              : "Эквайринг и чек при оплате через платформу — на нас. Сумма указана после комиссий."}
                          </p>
                        </div>
                      )}
                      {isCommercialMode && (
                        <button
                          type="button"
                          onClick={() => setPromoteOpen(true)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-sm transition-colors"
                          title="Продвинуть это объявление в каталоге"
                        >
                          <Sparkles className="w-4 h-4" /> Продвигать объявление
                        </button>
                      )}
                    </>
                  );
                })()}
                {(() => {
                  const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
                  const maxProt = (listing as any).maxProtectionLimit as number | undefined;
                  const deposit = calcDeposit(listing.pricePerDay);
                  const ownerProt = (listing as any).ownerProtectionEnabled !== false;
                  return (
                    <div className="space-y-2 mt-4">
                      {/* Deposit block */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-xl">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <div>
                          <p>Залог: <strong className="text-foreground">{formatPrice(deposit)}</strong> — возвращается сразу после сдачи вещи в том же состоянии.</p>
                          {isCommercialMode && ownerProt && maxProt && maxProt > 0 && (
                            <p className="text-xs mt-1 text-primary/80">Защита фонда: до <strong>{maxProt.toLocaleString("ru")} ₽</strong> при повреждении или краже</p>
                          )}
                        </div>
                      </div>
                      {/* Гарантийный фонд — мотивационный блок для арендатора (только в коммерч. режиме) */}
                      {isCommercialMode && ownerProt && !isOwnerRole && (
                        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 p-3 rounded-xl text-sm text-green-800">
                          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-green-800">Гарантийный фонд</p>
                            <p className="text-xs leading-relaxed text-green-700">Платформа выступает арбитром — если возникнет спор, мы разберёмся и возместим ущерб. Берите с уверенностью.</p>
                          </div>
                        </div>
                      )}
                      {/* Free-сделка: короткий контекст (только в коммерч. режиме). */}
                      {isCommercialMode && !ownerProt && !isOwnerRole && (
                        <div className="flex items-start gap-2.5 bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 p-3 rounded-xl">
                          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                          <div>
                            <p className="font-semibold text-foreground text-sm">Защитите сделку сами</p>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                              Это объявление без Гарантийного фонда. При бронировании вы можете <b>включить защиту</b> — платформа возьмёт сделку под эскроу и возместит ущерб через арбитраж.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Бета-режим: общий info-баннер для всех пользователей */}
                      {isBetaMode && !isOwnerRole && (
                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 p-3 rounded-xl text-sm">
                          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-amber-900">Бета-режим</p>
                            <p className="text-xs leading-relaxed text-amber-800">
                              Оплата аренды происходит <b>напрямую владельцу</b> при встрече (наличными или по СБП). Платформа сейчас работает как доска объявлений — никаких комиссий и удержаний.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {!listing.isAvailable ? (
                <div className="bg-destructive/10 text-destructive text-center p-4 rounded-xl font-bold">
                  Временно недоступно для аренды
                </div>
              ) : isOwnerRole && currentUser?.id === (listing as any).ownerId ? (
                /* Owner viewing their OWN listing */
                <div className="space-y-3">
                  {isBetaMode ? (
                    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <Info className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="font-bold text-amber-900 text-sm">Бета-режим: объявление активно</p>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Размещение бесплатное, платформа работает как доска объявлений. Когда арендатор оставит заявку — свяжитесь с ним и договоритесь о встрече и оплате напрямую (наличные или СБП).
                      </p>
                    </div>
                  ) : (() => {
                    const ownerProt = (listing as any).ownerProtectionEnabled !== false;
                    const maxProt = (listing as any).maxProtectionLimit as number | undefined;
                    return ownerProt ? (
                      <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <Shield className="w-5 h-5 text-green-600 shrink-0" />
                          <div>
                            <p className="font-bold text-green-800 text-sm">Гарантийный фонд подключён</p>
                            {maxProt && maxProt > 0 && (
                              <p className="text-xs text-green-700 mt-0.5">Лимит компенсации: <strong>{maxProt.toLocaleString("ru")} ₽</strong></p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs text-green-700">
                          <p className="flex items-start gap-1.5"><span className="text-green-500 font-bold mt-0.5">•</span> Если арендатор повредит или не вернёт вещь — фонд возместит до <strong>{maxProt && maxProt > 0 ? `${maxProt.toLocaleString("ru")} ₽` : "лимита фонда"}</strong> по решению арбитража</p>
                          <p className="flex items-start gap-1.5"><span className="text-green-500 font-bold mt-0.5">•</span> Объявления с фондом просматривают <strong>2× чаще</strong></p>
                          <p className="flex items-start gap-1.5"><span className="text-green-500 font-bold mt-0.5">•</span> Все споры решает арбитраж — вам не нужно разбираться самому</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <ShieldOff className="w-5 h-5 text-amber-600 shrink-0" />
                          <div>
                            <p className="font-bold text-amber-900 text-sm">Гарантийный фонд отключён</p>
                            <p className="text-xs text-amber-700 mt-0.5">Ваше объявление получает меньше доверия</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs text-amber-800">
                          <p className="flex items-start gap-1.5"><span className="text-amber-500 font-bold mt-0.5">•</span> Объявления с фондом просматривают на <strong>2× чаще</strong></p>
                          <p className="flex items-start gap-1.5"><span className="text-amber-500 font-bold mt-0.5">•</span> При повреждении фонд покрывает ущерб — вы не теряете деньги</p>
                          <p className="flex items-start gap-1.5"><span className="text-amber-500 font-bold mt-0.5">•</span> Арбитраж решает споры нейтрально — без стресса</p>
                        </div>
                        <Link
                          href={`/dashboard/listings/${listing.id}/edit`}
                          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Подключить защиту
                        </Link>
                      </div>
                    );
                  })()}
                  <Link
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-border hover:bg-muted text-sm font-semibold transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Редактировать объявление
                  </Link>
                </div>
              ) : isOwnerRole ? (
                /* Owner viewing someone ELSE's listing */
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 mb-1">Вы в роли владельца</h4>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        Чтобы арендовать чужую вещь, нужно переключиться в роль <strong>арендатора</strong> в настройках профиля.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard?tab=profile"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Сменить роль в настройках
                  </Link>
                </div>
              ) : !isAuthenticated ? (
                /* Неавторизованный пользователь — мотивация к регистрации */
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-5 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-display font-black text-lg mb-1.5">Войдите, чтобы арендовать</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {isBetaMode
                        ? "После регистрации вы увидите календарь свободных дат и сможете отправить заявку владельцу. Оплата проходит напрямую при встрече."
                        : "После регистрации вы увидите календарь свободных дат, точную стоимость аренды и сможете отправить заявку владельцу — всё под защитой Гарантийного фонда."}
                    </p>
                    <ul className="text-left space-y-2 mb-5 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <span>Календарь со свободными датами</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <span>{isBetaMode ? "Заявка отправляется бесплатно" : "Платите только за нужные дни — без переплат"}</span>
                      </li>
                      {isCommercialMode && (
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                          <span>Защита сделки и арбитраж при спорах</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <span>Чат с владельцем прямо на платформе</span>
                      </li>
                    </ul>
                    <Link href="/auth" className="btn-primary w-full block py-3.5 text-base mb-2">
                      Войти или зарегистрироваться
                    </Link>
                    <p className="text-[11px] text-muted-foreground">Регистрация займёт меньше минуты</p>
                  </div>
                  {(() => {
                    const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
                    const ownerProt = (listing as any).ownerProtectionEnabled !== false;
                    // В Бета-режиме комиссии и фонд отключены — total = pricePerDay.
                    // Не вызываем calculateTotalPrice, чтобы не «протекли» commercial-надбавки.
                    const total = isBetaMode
                      ? Number(listing.pricePerDay)
                      : calculateTotalPrice(listing.pricePerDay, cat, 1, ownerProt).total;
                    return (
                      <div className="rounded-2xl bg-muted/40 p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Стоимость аренды</p>
                        <p className="text-2xl font-display font-black text-primary">от {formatPrice(total)} <span className="text-sm font-bold text-muted-foreground">/ сутки</span></p>
                        <p className="text-[11px] text-muted-foreground mt-1">Точная цена — после выбора дат в личном кабинете</p>
                      </div>
                    );
                  })()}
                </div>
              ) : bookingSuccess ? (
                <div className="text-center py-6">
                  <div className={`w-16 h-16 ${protectionEnabled ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    {protectionEnabled ? <CheckCircle2 className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {protectionEnabled ? "Заявка отправлена!" : "Контакты открыты!"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {protectionEnabled
                      ? "Владелец свяжется с вами в ближайшее время. Отслеживайте статус в личном кабинете."
                      : "Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую для договорённости."}
                  </p>
                  <Link href="/dashboard" className="btn-secondary w-full justify-center">В личный кабинет</Link>
                </div>
              ) : (
                <>
                  {/* ─── Consequence Modal ──────────────────────────────── */}
                  {showConsequenceModal && (() => {
                    const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
                    const deposit = calcDeposit(listing.pricePerDay);
                    const savingsEstimate = totalDays > 0
                      ? (() => {
                          const { combinedServiceFee } = calculateTotalPrice(listing.pricePerDay, cat, totalDays);
                          return Math.round(combinedServiceFee);
                        })()
                      : 0;
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-background rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-border">
                          <div className="flex flex-col items-center text-center mb-5">
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
                              <ShieldOff className="w-8 h-8 text-destructive" />
                            </div>
                            <h3 className="text-xl font-black mb-1">Отключить защиту?</h3>
                            <p className="text-sm text-muted-foreground">
                              Вы переходите на режим <strong>Прямого расчёта</strong>
                            </p>
                          </div>

                          {savingsEstimate > 0 && (
                            <div className="flex gap-3 mb-4">
                              <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                <div className="text-xs text-green-700 mb-1">Экономия</div>
                                <div className="text-lg font-black text-green-700">~{formatPrice(savingsEstimate)}</div>
                                <div className="text-xs text-green-600">комиссий и фонда</div>
                              </div>
                              {deposit > 0 && (
                                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                  <div className="text-xs text-red-700 mb-1">Ваш риск</div>
                                  <div className="text-lg font-black text-red-700">{formatPrice(deposit)}</div>
                                  <div className="text-xs text-red-600">без гарантии возврата</div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="bg-muted/60 rounded-xl p-4 mb-5 space-y-2 text-sm">
                            <p className="font-bold text-foreground text-xs uppercase tracking-wide mb-2">Что вы теряете:</p>
                            {[
                              "GPS-акт приёма/сдачи вещи",
                              "Фото и видео фиксация состояния",
                              "Гарантийный фонд (возмещение ущерба)",
                              "Арбитраж при спорах",
                            ].map(item => (
                              <div key={item} className="flex items-center gap-2 text-muted-foreground">
                                <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                                {item}
                              </div>
                            ))}
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-sm text-blue-800">
                            <strong>Прямой расчёт:</strong> платите {contactPriceSingle} ₽ и сразу получаете контакты владельца. Все договорённости — на ваше усмотрение.
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setShowConsequenceModal(false)}
                              className="flex-1 py-3 rounded-xl border-2 border-primary text-primary font-bold text-sm hover:bg-primary/5 transition-colors"
                            >
                              Оставить защиту
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProtectionEnabled(false);
                                setShowConsequenceModal(false);
                              }}
                              className="flex-1 py-3 rounded-xl bg-destructive text-white font-bold text-sm hover:bg-destructive/90 transition-colors"
                            >
                              Отключить
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <form onSubmit={handleBooking} className="space-y-4">

                    {/* ─── Protection toggle (только в коммерч. режиме) ── */}
                    {isCommercialMode && (
                    <div className={`rounded-2xl border-2 p-4 transition-colors ${protectionEnabled ? "border-primary/30 bg-primary/5" : "border-orange-300 bg-orange-50"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {protectionEnabled
                            ? <Shield className="w-5 h-5 text-primary shrink-0" />
                            : <ShieldOff className="w-5 h-5 text-orange-500 shrink-0" />
                          }
                          <div>
                            <p className={`font-bold text-sm ${protectionEnabled ? "text-primary" : "text-orange-700"}`}>
                              {protectionEnabled
                                ? (isFreeListing ? "Защищённая сделка (апгрейд)" : "Безопасная сделка")
                                : "Прямой расчёт"}
                            </p>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {protectionEnabled
                                ? (isFreeListing
                                    ? "Гарантийный фонд + арбитраж — за ваш счёт"
                                    : "Защита, гарантийный фонд, арбитраж")
                                : `Без защиты — ${contactPriceSingle} ₽ за контакты`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={protectionEnabled}
                          onClick={() => protectionEnabled ? setShowConsequenceModal(true) : setProtectionEnabled(true)}
                          className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${protectionEnabled ? "bg-primary" : "bg-orange-400"}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${protectionEnabled ? "left-7" : "left-1"}`} />
                        </button>
                      </div>

                      {/* ─── Пояснение апгрейда Free → Premium (свернуто) ─── */}
                      {isFreeListing && (
                        <div className="mt-2 pt-2 border-t border-primary/10">
                          <button
                            type="button"
                            onClick={() => setShowFreeUpgradeDetails(v => !v)}
                            className="text-[11px] text-primary/70 hover:text-primary inline-flex items-center gap-1 font-semibold"
                          >
                            <Info className="w-3 h-3" />
                            {showFreeUpgradeDetails ? "Скрыть детали" : "Подробнее"}
                          </button>
                          {showFreeUpgradeDetails && (
                            <div className="mt-2 text-[11px] text-muted-foreground space-y-1 leading-snug">
                              {protectionEnabled ? (
                                <>
                                  <p>
                                    Владелец выбрал <b>Free-тариф</b>. Вы проводите сделку через Гарантийный фонд — к аренде добавится Shield Fee
                                    {publicSettings?.shieldFeePercent ? ` (${publicSettings.shieldFeePercent}%, минимум ${publicSettings.shieldFeeMin ?? 0} ₽)` : ""}.
                                  </p>
                                  <p>Владельцу придёт уведомление о смене типа сделки.</p>
                                </>
                              ) : (
                                <p className="text-orange-700/90">
                                  Это Free-объявление: владелец работает без Гарантийного фонда. Вы можете включить защиту выше — комиссию заплатите вы.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )}

                    {/* ─── Календарь — всегда виден ──────────────────────── */}
                    <>
                      {/* Calendar hint */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        {!startDate
                          ? (protectionEnabled
                              ? "Выберите дату начала аренды"
                              : "Укажите желаемый период — владелец увидит запрос")
                          : !endDate
                          ? "Теперь выберите дату окончания"
                          : (
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">
                                {format(parseISO(startDate), "d MMM", { locale: ru })} — {format(parseISO(endDate), "d MMM yyyy", { locale: ru })}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span>{totalDays} {totalDays === 1 ? "сутки" : totalDays < 5 ? "суток" : "суток"}</span>
                              <button
                                type="button"
                                onClick={() => { setStartDate(""); setEndDate(""); }}
                                className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" /> сбросить
                              </button>
                            </span>
                          )
                        }
                      </div>

                      {/* Booking calendar */}
                      <div className="bg-muted/30 rounded-2xl p-3 border border-border">
                        <BookingCalendar
                          bookedRanges={bookedRanges}
                          startDate={startDate}
                          endDate={endDate}
                          onSelect={handleDateSelect}
                        />
                      </div>

                      {/* Пояснение для Прямого расчёта */}
                      {!protectionEnabled && startDate && endDate && (
                        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
                          <CalendarDays className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Выбранный период будет отображаться в календаре владельца — он сможет подготовиться и не примет пересекающиеся заявки.</span>
                        </div>
                      )}
                    </>

                    {/* Price summary */}
                    {isBetaMode ? (
                      startDate && endDate && totalDays > 0 ? (
                        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{totalDays} {totalDays === 1 ? "сутки" : "суток"} × {formatPrice(listing.pricePerDay)}</span>
                            <span className="text-foreground font-medium">{formatPrice(Number(listing.pricePerDay) * totalDays)}</span>
                          </div>
                          <div className="flex justify-between items-center font-bold border-t border-amber-300 pt-2">
                            <span>К оплате владельцу</span>
                            <span className="text-xl text-amber-700">{formatPrice(Number(listing.pricePerDay) * totalDays)}</span>
                          </div>
                          <div className="flex items-start gap-2 text-[11px] text-amber-900 leading-snug pt-1 border-t border-amber-300">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <span>
                              <b>Бета-режим:</b> оплата происходит напрямую владельцу при встрече (наличными или СБП). Платформа не удерживает комиссий.
                            </span>
                          </div>
                        </div>
                      ) : null
                    ) : !protectionEnabled ? (
                      <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl space-y-1.5 text-sm">
                        {startDate && endDate && totalDays > 0 && (
                          <>
                            <div className="flex justify-between text-muted-foreground pb-1 border-b border-orange-200 mb-1">
                              <span>Желаемый период</span>
                              <span className="font-medium text-foreground">
                                {format(parseISO(startDate), "d MMM", { locale: ru })} — {format(parseISO(endDate), "d MMM", { locale: ru })} ({totalDays} {totalDays === 1 ? "сутки" : "суток"})
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>{totalDays} {totalDays === 1 ? "сутки" : "суток"} × {formatPrice(listing.pricePerDay)}</span>
                              <span className="text-foreground font-medium">{formatPrice(Number(listing.pricePerDay) * totalDays)}</span>
                            </div>
                            <p className="text-xs text-orange-600 italic">↑ Это ориентировочная сумма — вы платите напрямую владельцу</p>
                            <div className="border-t border-orange-200 my-1" />
                          </>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                          <span>Открытие контактов (на платформе)</span>
                          <span>{contactPriceSingle} ₽</span>
                        </div>
                        <div className="flex justify-between items-center font-bold border-t border-orange-200 pt-1.5 mt-1">
                          <span>Платёж сейчас</span>
                          <span className="text-lg text-orange-700">{contactPriceSingle} ₽</span>
                        </div>
                        <p className="text-xs text-orange-600 pt-1">Контакты владельца откроются сразу после оплаты</p>
                      </div>
                    ) : startDate && endDate && (() => {
                      const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
                      const ownerProt = (listing as any).ownerProtectionEnabled !== false;
                      const breakdown = calculateTotalPrice(listing.pricePerDay, cat, totalDays, ownerProt, renterFundEnabled);
                      const { rent, renterFundContrib, serviceFee, taxFee, total, deposit, isFreeUpgrade, fundShare } = breakdown;
                      const platformFees = (isFreeUpgrade ? serviceFee + taxFee : 0) + renterFundContrib;
                      // Полная цена защиты для Free-сделки (если арендатор её сейчас не включил):
                      // включает не только взнос в фонд, но и сервис+налог.
                      const upgradeFullCost = !ownerProt && !renterFundEnabled
                        ? (() => {
                            const b2 = calculateTotalPrice(listing.pricePerDay, cat, totalDays, ownerProt, true);
                            return b2.total - rent;
                          })()
                        : 0;
                      return (
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{totalDays} {totalDays === 1 ? "сутки" : "суток"} × {formatPrice(listing.pricePerDay)}</span>
                            <span>{formatPrice(rent)}</span>
                          </div>

                          {platformFees > 0 && (
                            <div className="flex justify-between text-primary/80 text-xs">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Сервис и защита
                                <button
                                  type="button"
                                  onClick={() => setShowFeeDetails(v => !v)}
                                  className="text-primary/60 hover:text-primary"
                                  aria-label="Подробнее"
                                >
                                  <Info className="w-3 h-3" />
                                </button>
                              </span>
                              <span>{formatPrice(platformFees)}</span>
                            </div>
                          )}

                          {showFeeDetails && platformFees > 0 && (
                            <div className="bg-white/70 border border-primary/10 rounded-lg p-2.5 text-[11px] text-muted-foreground space-y-2">
                              {isFreeUpgrade && serviceFee + taxFee > 0 && (
                                <div>
                                  <div className="flex justify-between text-foreground">
                                    <span className="font-medium">Безопасная сделка через эскроу</span>
                                    <span>{formatPrice(serviceFee + taxFee)}</span>
                                  </div>
                                  <p className="text-[10.5px] leading-snug text-muted-foreground mt-0.5">
                                    Деньги попадают владельцу <b>только после</b> того, как вы получили вещь. Чек, поддержка и проведение возврата — на нас.
                                  </p>
                                </div>
                              )}
                              {renterFundContrib > 0 && (
                                <div>
                                  <div className="flex justify-between text-foreground">
                                    <span className="font-medium">Защита Гарантийным фондом</span>
                                    <span>{formatPrice(renterFundContrib)}</span>
                                  </div>
                                  <p className="text-[10.5px] leading-snug text-muted-foreground mt-0.5">
                                    Если случится поломка, утеря или спор — фонд компенсирует ущерб <b>по решению арбитража</b> (в пределах лимита). Вы не остаётесь один на один с владельцем.
                                  </p>
                                </div>
                              )}
                              {isFreeUpgrade && (
                                <p className="pt-1 text-green-700 leading-snug border-t border-primary/10">
                                  Сравните: личная встреча с незнакомцем, наличные, риск залогом. Здесь — карта, защита и поддержка за {formatPrice(platformFees)} на всю сделку.
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center font-bold border-t border-primary/20 pt-2 mt-1">
                            <span>Итого к оплате</span>
                            <span className="text-xl text-primary">{formatPrice(total)}</span>
                          </div>

                          {/* Stage 21b — дисклеймер бета-режима под итоговой ценой.
                              Виден только когда `is_commercial_mode = false` (мок-режим). */}
                          {publicSettings?.isCommercialMode === false && (
                            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 flex gap-2">
                              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                              <span>
                                <b>Бета-тест:</b> взносы 0 ₽. Платформа помогает в спорах как арбитр на основе
                                Цифрового акта, но прямые выплаты из фонда временно недоступны.
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between text-amber-700 text-[11px] pt-1.5 border-t border-primary/10">
                            <span className="flex items-center gap-1">
                              Залог
                              <span className="text-muted-foreground">(вернётся)</span>
                            </span>
                            <span className="font-medium">{formatPrice(deposit)}</span>
                          </div>

                          {/* Чекбокс защиты Гарантийным фондом —
                              для Free-сделки выделяем заметным CTA, для Premium оставляем тонкой опцией.
                              В Бета-режиме коммерция отключена — чекбоксы скрыты. */}
                          {isCommercialMode && (!ownerProt ? (
                            <label className={`flex items-start gap-2.5 cursor-pointer mt-2 p-2.5 rounded-lg border-2 transition-colors ${
                              renterFundEnabled
                                ? "border-green-300 bg-green-50"
                                : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                            }`}>
                              <input
                                type="checkbox"
                                checked={renterFundEnabled}
                                onChange={(e) => setRenterFundEnabled(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                              />
                              <span className="text-xs leading-snug">
                                <span className={`font-semibold ${renterFundEnabled ? "text-green-800" : "text-foreground"}`}>
                                  {renterFundEnabled
                                    ? `Защита включена (+${formatPrice(platformFees)} к аренде)`
                                    : `Включить защиту за ${formatPrice(upgradeFullCost)}`}
                                </span>
                                <span className={`block text-[11px] mt-0.5 ${renterFundEnabled ? "text-green-700" : "text-muted-foreground"}`}>
                                  {renterFundEnabled
                                    ? "Включает фонд возмещения, эскроу и арбитраж. Владелец получает 100% аренды."
                                    : "Эскроу + фонд возмещения + арбитраж. Платите вы — владелец получает 100% аренды."}
                                </span>
                              </span>
                            </label>
                          ) : (
                            <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-primary/10 mt-1">
                              <input
                                type="checkbox"
                                checked={renterFundEnabled}
                                onChange={(e) => setRenterFundEnabled(e.target.checked)}
                                className="mt-0.5 w-3.5 h-3.5 rounded accent-primary cursor-pointer shrink-0"
                              />
                              <span className="text-[11px] text-muted-foreground leading-snug">
                                Защитить меня Гарантийным фондом
                                {renterFundEnabled ? "" : ` (+${formatPrice(fundShare)})`}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })()}

                    <div>
                      <label className="block text-sm font-bold mb-2 text-muted-foreground">Сообщение владельцу (необязательно)</label>
                      <textarea
                        className="input-field min-h-[80px] resize-y"
                        placeholder={protectionEnabled
                          ? "Напишите, для чего вам вещь и когда удобнее забрать..."
                          : "Кратко о себе и когда удобно созвониться..."}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                      />
                    </div>

                    {bookingError && (
                      <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-xl mt-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>{bookingError}</p>
                      </div>
                    )}

                    {isAuthenticated ? (
                      <button
                        type="submit"
                        className={`w-full py-4 text-lg mt-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 ${
                          protectionEnabled
                            ? "btn-primary"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                        disabled={createBooking.isPending || !startDate || !endDate}
                      >
                        {createBooking.isPending
                          ? "Отправка..."
                          : protectionEnabled
                            ? "Отправить заявку"
                            : (!startDate || !endDate)
                              ? "Выберите период аренды"
                              : <><Phone className="w-5 h-5" /> Получить контакты ({contactPriceSingle} ₽)</>
                        }
                      </button>
                    ) : (
                      <div className="text-center mt-4">
                        <Link href="/auth" className="btn-primary w-full block py-4 text-lg mb-2">
                          Войти для аренды
                        </Link>
                        <span className="text-xs text-muted-foreground">Регистрация займет 1 минуту</span>
                      </div>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {promoteOpen && listing && (
        <PromoteListingModal
          listingId={listing.id}
          listingTitle={listing.title}
          token={getToken() ?? ""}
          apiBase={import.meta.env.VITE_API_URL ?? ""}
          onClose={() => setPromoteOpen(false)}
        />
      )}
    </Layout>
  );
}
