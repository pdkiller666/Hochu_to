import { Layout } from "@/components/layout/Layout";
import { useRoute } from "wouter";
import { useGetListingById, useGetListingUnavailableDates, useCreateBooking, useGetCurrentUser } from "@workspace/api-client-react";
import { Loader2, MapPin, Star, Shield, ShieldOff, Info, User, ChevronLeft, CheckCircle2, AlertTriangle, Settings, CalendarDays, X, Expand, Hash, MessageSquare, Phone } from "lucide-react";
import { formatPrice, calculateTotalPrice, getFundRate, getDeposit } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useAuthState } from "@/lib/auth";
import { Link } from "wouter";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";
import { BookingCalendar, BookedRange } from "@/components/BookingCalendar";
import { Lightbox } from "@/components/ui/Lightbox";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";
import { ReviewCard, ReviewData } from "@/components/ui/ReviewCard";
import { StarRating, RatingDisplay } from "@/components/ui/StarRating";
import { ListingMap } from "@/components/ui/ListingMap";

export default function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const id = Number(params?.id);
  const { isAuthenticated, token } = useAuthState();
  const API_BASE = import.meta.env.VITE_API_URL ?? "";

  const { data: listing, isLoading, error } = useGetListingById(id);
  const { data: unavailableDates } = useGetListingUnavailableDates(id);

  const { data: currentUser } = useGetCurrentUser(
    { request: { headers: { Authorization: `Bearer ${token}` } } },
    { query: { enabled: !!token } }
  );

  const createBooking = useCreateBooking({
    request: { headers: { Authorization: `Bearer ${token}` } }
  });

  const isOwnerRole = isAuthenticated && currentUser?.role === "owner";

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [showConsequenceModal, setShowConsequenceModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mainImgError, setMainImgError] = useState(false);

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

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (protectionEnabled && (!startDate || !endDate)) return;
    createBooking.mutate({
      data: {
        listingId: id,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        message,
        protectionEnabled,
      } as any
    }, {
      onSuccess: () => setBookingSuccess(true),
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
              <h1 className="text-3xl font-bold">{listing.title}</h1>
            </div>

            {/* Photo Gallery */}
            <div className="space-y-2">
              {/* Main photo */}
              <div
                className={`relative aspect-[4/3] rounded-3xl overflow-hidden bg-muted border border-border shadow-sm group ${photos.length > 0 && !mainImgError ? "cursor-zoom-in" : ""}`}
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
              <h1 className="text-4xl font-bold mb-4">{listing.title}</h1>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground pb-6 border-b border-border">
                <div className="flex items-center gap-1.5 font-medium text-foreground bg-amber-50 text-amber-700 px-3 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-current" />
                  {avgRating > 0 ? `${avgRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "отзыв" : reviewCount < 5 ? "отзыва" : "отзывов"})` : "Нет отзывов"}
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
                <ListingMap
                  city={(listing as any).city}
                  regionName={listing.regionName}
                  lat={(listing as any).lat}
                  lng={(listing as any).lng}
                />
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
                  <h4 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{listing.ownerName || "Владелец"}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Shield className="w-3.5 h-3.5 text-green-500" /> Подтвержденный профиль
                  </p>
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
                {(() => {
                  const mv = (listing as any).marketValue as number | undefined;
                  const deposit = getDeposit(listing.pricePerDay);
                  const isHighValue = mv && mv > 100_000;
                  return (
                    <div className="space-y-2 mt-4">
                      {/* Deposit block */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-xl">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <div>
                          <p>Залог: <strong className="text-foreground">{formatPrice(deposit)}</strong> — возвращается сразу после сдачи вещи в том же состоянии.</p>
                          {mv && mv > 0 && (
                            <p className="text-xs mt-1 text-primary/80">Фонд покрывает ремонт до 70% от стоимости вещи</p>
                          )}
                        </div>
                      </div>
                      {/* High-value badge */}
                      {isHighValue && (
                        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 px-3 py-2 rounded-xl text-xs text-violet-700">
                          <Shield className="w-3.5 h-3.5 shrink-0" />
                          <span><strong>Высокая ценность</strong> — рекомендуется аккаунт с верификацией</span>
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
              ) : isOwnerRole ? (
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
                    const mv = (listing as any).marketValue as number | undefined;
                    const deposit = getDeposit(listing.pricePerDay);
                    const savingsEstimate = totalDays > 0
                      ? (() => {
                          const { serviceFee, taxFee, fundContribution } = calculateTotalPrice(listing.pricePerDay, mv ?? 0, totalDays);
                          return Math.round(serviceFee + taxFee + fundContribution);
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
                            <strong>Прямой расчёт:</strong> платите 150 ₽ и сразу получаете контакты владельца. Все договорённости — на ваше усмотрение.
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

                    {/* ─── Protection toggle ────────────────────────────── */}
                    <div className={`rounded-2xl border-2 p-4 transition-colors ${protectionEnabled ? "border-primary/30 bg-primary/5" : "border-orange-300 bg-orange-50"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {protectionEnabled
                            ? <Shield className="w-5 h-5 text-primary shrink-0" />
                            : <ShieldOff className="w-5 h-5 text-orange-500 shrink-0" />
                          }
                          <div>
                            <p className={`font-bold text-sm ${protectionEnabled ? "text-primary" : "text-orange-700"}`}>
                              {protectionEnabled ? "Безопасная сделка" : "Прямой расчёт"}
                            </p>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {protectionEnabled
                                ? "Защита, гарантийный фонд, арбитраж"
                                : "Без защиты — 150 ₽ за контакты"}
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
                    </div>

                    {/* Calendar section — shown only for Сценарий А */}
                    {protectionEnabled && (
                      <>
                        {/* Calendar hint */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                          {!startDate
                            ? "Нажмите на дату начала аренды"
                            : !endDate
                            ? "Теперь выберите дату окончания"
                            : (
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {format(parseISO(startDate), "d MMM", { locale: ru })} — {format(parseISO(endDate), "d MMM yyyy", { locale: ru })}
                                </span>
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
                      </>
                    )}

                    {/* Price summary */}
                    {!protectionEnabled ? (
                      <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Открытие контактов</span>
                          <span>150 ₽</span>
                        </div>
                        <div className="flex justify-between items-center font-bold border-t border-orange-200 pt-1.5 mt-1">
                          <span>Итого</span>
                          <span className="text-lg text-orange-700">150 ₽</span>
                        </div>
                        <p className="text-xs text-orange-600 pt-1">Контакты владельца откроются сразу после оплаты</p>
                      </div>
                    ) : startDate && endDate && (() => {
                      const mv = (listing as any).marketValue as number | undefined;
                      const { rent, serviceFee, taxFee, fundContribution, fundRate, total, deposit } =
                        calculateTotalPrice(listing.pricePerDay, mv ?? 0, totalDays);
                      const fundPct = mv ? `${(fundRate * 100).toFixed(1)}%` : null;
                      return (
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-1.5 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{totalDays} {totalDays === 1 ? "сутки" : "суток"} × {formatPrice(listing.pricePerDay)}</span>
                            <span>{formatPrice(rent)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Комиссия сервиса (10%)</span>
                            <span>{formatPrice(serviceFee)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Налог самозанятого (6%)</span>
                            <span>{formatPrice(taxFee)}</span>
                          </div>
                          {mv && mv > 0 && fundContribution > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>
                                Гарантийный фонд
                                {fundPct && (
                                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                    {fundPct}/день
                                  </span>
                                )}
                              </span>
                              <span>{formatPrice(fundContribution)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center font-bold border-t border-primary/20 pt-1.5 mt-1">
                            <span>Итого к оплате</span>
                            <span className="text-lg text-primary">{formatPrice(total)}</span>
                          </div>
                          <div className="flex justify-between text-amber-700 text-xs pt-1">
                            <span>+ залог (возвращается сразу после сдачи)</span>
                            <span className="font-medium">{formatPrice(deposit)}</span>
                          </div>
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

                    {isAuthenticated ? (
                      <button
                        type="submit"
                        className={`w-full py-4 text-lg mt-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 ${
                          protectionEnabled
                            ? "btn-primary"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                        disabled={createBooking.isPending || (protectionEnabled && (!startDate || !endDate))}
                      >
                        {createBooking.isPending
                          ? "Отправка..."
                          : protectionEnabled
                            ? "Отправить заявку"
                            : <><Phone className="w-5 h-5" /> Получить контакты (150 ₽)</>
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
    </Layout>
  );
}
