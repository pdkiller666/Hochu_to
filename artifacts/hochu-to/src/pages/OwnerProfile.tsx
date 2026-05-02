import { Layout } from "@/components/layout/Layout";
import { useRoute, Link } from "wouter";
import { useGetUserById, useGetUserListings } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/ListingCard";
import {
  Shield,
  MapPin,
  CalendarDays,
  Package,
  ShoppingBag,
  Star,
  Lock,
  ChevronLeft,
  User,
  MessageSquare,
  Award,
  ShieldCheck,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useEffect } from "react";
import { ReviewCard, ReviewData } from "@/components/ui/ReviewCard";
import { StarRating } from "@/components/ui/StarRating";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getAvatarSrc(url?: string) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

// Stage 32.1 — цветовая шкала Trust Score
const getTrustScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-stone-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-stone-500";
  return "text-amber-600";
};

export default function OwnerProfile() {
  const [, params] = useRoute("/users/:id");
  const id = Number(params?.id);

  const { data: user, isLoading: userLoading, error: userError } = useGetUserById(id);
  const { data: listingsData, isLoading: listingsLoading } = useGetUserListings(id);

  const [userReviews, setUserReviews] = useState<(ReviewData & { listingTitle?: string })[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    fetch(`${API_BASE}/api/reviews/user/${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setUserReviews(Array.isArray(data) ? data : []))
      .catch(() => setUserReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  if (userLoading) {
    return (
      <Layout>
        <div className="container max-w-5xl mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full w-10 h-10 border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (userError || !user) {
    return (
      <Layout>
        <div className="container max-w-5xl mx-auto px-4 py-24 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold mb-2">Профиль не найден</h2>
          <p className="text-muted-foreground mb-8">Возможно, пользователь удалил аккаунт или ссылка устарела.</p>
          <Link href="/catalog" className="btn-primary px-6 py-3 rounded-xl">Перейти в каталог</Link>
        </div>
      </Layout>
    );
  }

  const avatarSrc = getAvatarSrc(user.avatar);
  const allListings = listingsData ?? [];
  const activeListings = allListings.filter((l) => l.isAvailable);

  const memberSince = (() => {
    try {
      return format(parseISO(user.createdAt), "LLLL yyyy", { locale: ru });
    } catch {
      return "";
    }
  })();

  const STAFF_ROLES = ["superadmin", "admin", "moderator", "support", "arbiter"];
  const isStaff = STAFF_ROLES.includes(user.role as string);
  const roleLabel = user.role === "owner" ? "Владелец" : "Арендатор";
  const roleColor = user.role === "owner" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";

  return (
    <Layout>
      {/* Back */}
      <div className="container max-w-5xl mx-auto px-4 pt-6">
        <button onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>
      </div>

      {/* Hero Card */}
      <div className="container max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          {/* Top gradient banner */}
          <div className="h-28 bg-gradient-to-r from-[#C65D3B]/15 via-[#4A8587]/10 to-[#C65D3B]/5" />

          {/* Profile row */}
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-5">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-md bg-secondary flex items-center justify-center text-3xl font-bold text-secondary-foreground overflow-hidden shrink-0">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold truncate">{user.name}</h1>
                  {/* Stage 37 — Staff Badge */}
                  {isStaff && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0ea5e9] text-white">
                      <Shield className="w-3 h-3" /> Команда Хочу_То
                    </span>
                  )}
                  {/* Stage 19g — бейдж «Проверенный владелец» (Уровень 1). Показываем только если админ верифицировал. */}
                  {(user as any).isVerified && (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full"
                      title={(user as any).verifiedAt ? `Проверен ${new Date((user as any).verifiedAt).toLocaleDateString("ru-RU")}` : "Проверенный владелец"}
                    >
                      <Award className="w-3 h-3" /> Проверенный владелец
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleColor}`}>{roleLabel}</span>
                  {user.regionName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {user.regionName}
                    </span>
                  )}
                  {memberSince && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" /> На сайте с {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className={`grid gap-3 mb-5 ${user.role === "owner" ? "grid-cols-3" : "grid-cols-2"}`}>
              {user.role === "owner" && (
                <div className="rounded-2xl bg-muted/60 p-3 sm:p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display">{user.totalListings}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">объявлений</div>
                </div>
              )}
              <div className="rounded-2xl bg-muted/60 p-3 sm:p-4 text-center">
                <div className="flex justify-center mb-1">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-display">{user.completedDeals ?? 0}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">сделок</div>
              </div>
              {user.rating && user.rating > 0 ? (
                <div className="rounded-2xl bg-muted/60 p-3 sm:p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display">{user.rating.toFixed(1)}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">рейтинг</div>
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/60 p-3 sm:p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display text-muted-foreground">—</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">рейтинг</div>
                </div>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <div className="bg-muted/40 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{user.bio}</p>
                </div>
              </div>
            )}

            {/* Stage 32.1 — виджет надёжности пользователя */}
            <div className="bg-[#F2EEE3] rounded-xl p-4 border border-stone-200 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className={`w-5 h-5 ${getTrustScoreColor((user as any).trustScore)}`} />
                <h3 className="font-semibold text-stone-800">Надёжность пользователя</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-stone-900">
                  {(user as any).trustScore !== null && (user as any).trustScore !== undefined ? `${(user as any).trustScore}%` : "Ещё нет оценок"}
                </span>
              </div>
              <div className="text-sm text-stone-600 mt-1">
                Завершённых сделок: {(user as any).completedDealsCount || (user as any).completedDeals || 0}
              </div>
            </div>

            {/* Contacts hidden notice */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Контакты владельца доступны только после подтверждения бронирования</span>
            </div>
          </div>
        </div>

        {/* Listings section */}
        {user.role === "owner" && (
          <div className="mt-10 mb-16">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">
                Объявления владельца
                {allListings.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({allListings.length})</span>
                )}
              </h2>
              {activeListings.length < allListings.length && allListings.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {activeListings.length} доступных из {allListings.length}
                </span>
              )}
            </div>

            {listingsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-muted animate-pulse h-64" />
                ))}
              </div>
            ) : allListings.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-border">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-muted-foreground">У этого владельца пока нет объявлений</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {allListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        )}

        {user.role !== "owner" && (
          <div className="text-center py-16 mb-8 bg-white rounded-3xl border border-border mt-8">
            <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Этот пользователь является арендатором и не публикует объявления</p>
            <Link href="/catalog" className="btn-secondary mt-4 inline-flex px-6 py-2.5 rounded-xl">
              Смотреть каталог
            </Link>
          </div>
        )}

        {/* Reviews section */}
        <div className="mt-8 mb-16">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold">
              {user.role === "owner" ? "Отзывы об арендодателе" : "Отзывы об арендаторе"}
            </h2>
            {userReviews.length > 0 && (
              <div className="flex items-center gap-1.5">
                <StarRating value={Math.round((user as any).rating ?? 0)} size="sm" />
                <span className="font-semibold">{((user as any).rating ?? 0).toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({userReviews.length})</span>
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : userReviews.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-border">
              <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Отзывов пока нет</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userReviews.map(r => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  showListing={user.role === "owner"}
                  apiBase={API_BASE}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
