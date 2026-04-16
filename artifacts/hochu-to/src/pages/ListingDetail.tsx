import { Layout } from "@/components/layout/Layout";
import { useRoute } from "wouter";
import { useGetListingById, useGetListingUnavailableDates, useCreateBooking, useGetCurrentUser } from "@workspace/api-client-react";
import { Loader2, MapPin, Star, Shield, Info, User, ChevronLeft, CheckCircle2, AlertTriangle, Settings, CalendarDays, X, Expand, Hash, MessageSquare } from "lucide-react";
import { formatPrice } from "@/lib/utils";
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
        setReviews(data.results || []);
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
      const bookings: any[] = data.results || [];
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
    if (!startDate || !endDate) return;
    createBooking.mutate({
      data: { listingId: id, startDate, endDate, message }
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
                {listing.deposit && listing.deposit > 0 && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-xl mt-4">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <p>Требуется залог: <strong className="text-foreground">{formatPrice(listing.deposit)}</strong>. Возвращается при сдаче вещи.</p>
                  </div>
                )}
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
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Заявка отправлена!</h3>
                  <p className="text-muted-foreground mb-6">Владелец свяжется с вами в ближайшее время. Отслеживайте статус в личном кабинете.</p>
                  <Link href="/dashboard" className="btn-secondary w-full justify-center">В личный кабинет</Link>
                </div>
              ) : (
                <form onSubmit={handleBooking} className="space-y-4">
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

                  {/* Price summary */}
                  {startDate && endDate && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-sm">{totalDays} {totalDays === 1 ? "сутки" : totalDays < 5 ? "суток" : "суток"} × {formatPrice(listing.pricePerDay)}</span>
                        <span className="text-xl text-primary">{formatPrice(listing.pricePerDay * totalDays)}</span>
                      </div>
                      {listing.deposit && listing.deposit > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">+ залог {formatPrice(listing.deposit)}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold mb-2 text-muted-foreground">Сообщение владельцу (необязательно)</label>
                    <textarea
                      className="input-field min-h-[80px] resize-y"
                      placeholder="Напишите, для чего вам вещь и когда удобнее забрать..."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                    />
                  </div>

                  {isAuthenticated ? (
                    <button 
                      type="submit" 
                      className="btn-primary w-full py-4 text-lg mt-4"
                      disabled={createBooking.isPending || !startDate || !endDate}
                    >
                      {createBooking.isPending ? "Отправка..." : "Отправить заявку"}
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
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
