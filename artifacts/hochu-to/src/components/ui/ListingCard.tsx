import { Link } from "wouter";
import { MapPin, Star, Heart, Info, ShieldCheck, Sparkles, Award, Flame, Crown, Zap, Tag, Phone } from "lucide-react";
import { Listing } from "@workspace/api-client-react";
import { formatPrice, calculateTotalPrice, calcDeposit, type ItemCategory } from "@/lib/utils";
import { useState } from "react";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";
import { useFavorites } from "@/lib/favorites-context";
import { getToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { ContactPurchaseModal } from "@/components/ui/ContactPurchaseModal";
import { usePublicSettings } from "@/lib/use-public-settings";

interface ListingCardProps {
  listing: Listing;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getPhotoSrc(url: string) {
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

type Badge = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className: string;
  tier: "paid" | "earned" | "default";
};

function getListingBadges(listing: Listing): Badge[] {
  const out: Badge[] = [];
  const l = listing as any;
  const now = Date.now();

  // ── Платные (приоритет в выдаче) ──────────────────────────────
  if (l.isFeatured && (!l.featuredUntil || new Date(l.featuredUntil).getTime() > now)) {
    out.push({ key: "vip", icon: Crown, label: "VIP", className: "bg-amber-100 text-amber-800 border-amber-300", tier: "paid" });
  }
  if (l.isUrgent && (!l.urgentUntil || new Date(l.urgentUntil).getTime() > now)) {
    out.push({ key: "urgent", icon: Zap, label: "Срочно", className: "bg-red-100 text-red-700 border-red-300", tier: "paid" });
  }

  // ── Тип сделки ────────────────────────────────────────────────
  if (l.ownerProtectionEnabled !== false) {
    out.push({ key: "safe", icon: ShieldCheck, label: "Безопасная сделка", className: "bg-green-50 text-green-700 border-green-200", tier: "default" });
  } else {
    out.push({ key: "free", icon: Tag, label: "Бесплатно", className: "bg-slate-50 text-slate-700 border-slate-200", tier: "default" });
  }
  const rating = typeof l.rating === "number" ? l.rating : 0;
  const reviewCount = typeof l.reviewCount === "number" ? l.reviewCount : 0;
  if (rating >= 4.5 && reviewCount >= 3) {
    out.push({ key: "rating", icon: Star, label: "Высокий рейтинг", className: "bg-amber-50 text-amber-700 border-amber-200", tier: "earned" });
  }
  if (reviewCount >= 10 && rating < 4.5) {
    out.push({ key: "popular", icon: Flame, label: "Часто берут", className: "bg-orange-50 text-orange-700 border-orange-200", tier: "earned" });
  }
  if (l.createdAt) {
    const daysAgo = (now - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 14) {
      out.push({ key: "new", icon: Sparkles, label: "Новинка", className: "bg-sky-50 text-sky-700 border-sky-200", tier: "earned" });
    }
  }
  if (l.ownerVerified || l.ownerIsVerified) {
    out.push({ key: "verified-owner", icon: Award, label: "Проверенный владелец", className: "bg-violet-50 text-violet-700 border-violet-200", tier: "earned" });
  }

  return out.slice(0, 3);
}

export function ListingCard({ listing }: ListingCardProps) {
  const [imgError, setImgError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const badges = getListingBadges(listing);
  const hasPhoto = (listing.photos?.length ?? 0) > 0 && !imgError;
  const photoUrl = listing.photos?.[0] ? getPhotoSrc(listing.photos[0]) : null;
  const { isFavorite, toggle } = useFavorites();
  const [, navigate] = useLocation();
  const fav = isFavorite(listing.id);
  const settings = usePublicSettings();
  const isFree = (listing as any).ownerProtectionEnabled === false;
  const contactPrice = settings?.contactPriceSingle ?? 0;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!getToken()) { navigate("/auth"); return; }
    toggle(listing.id);
  };

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContactOpen(true);
  };

  return (
    <div className="card-hover group relative flex flex-col h-full">
      {/* Category Badge */}
      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-bold rounded-full text-foreground shadow-sm">
          {listing.categoryName || "Категория"}
        </span>
      </div>

      {/* Favorite Button */}
      <button
        onClick={handleFavoriteClick}
        className={`absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all shadow-sm ${
          fav
            ? "text-rose-500 hover:text-rose-600"
            : "text-muted-foreground hover:text-rose-500 hover:bg-white"
        }`}
        title={fav ? "Удалить из избранного" : "Добавить в избранное"}
      >
        <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
      </button>

      {/* Image */}
      <Link href={`/listings/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {hasPhoto && photoUrl ? (
            <img
              src={photoUrl}
              alt={listing.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <ListingPlaceholder categoryName={listing.categoryName ?? undefined} />
          )}

          {!listing.isAvailable && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-4 py-2 bg-white text-foreground font-bold rounded-xl shadow-lg">Сдано</span>
            </div>
          )}
          {(listing.photos?.length ?? 0) > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {listing.photos!.length} фото
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 sm:p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1.5 gap-1.5">
          <h3 className="font-bold text-sm sm:text-lg leading-tight line-clamp-2" title={listing.title}>
            {listing.title}
          </h3>
          {listing.rating ? (
            <div className="flex items-center gap-0.5 text-xs sm:text-sm font-bold bg-amber-50 text-amber-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md shrink-0">
              <Star className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-current" />
              {listing.rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm mb-3">
          <MapPin className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
          <span className="truncate">
            {(listing as any).city
              ? `${(listing as any).city}, ${listing.regionName || ""}`
              : listing.regionName || "Регион не указан"}
          </span>
        </div>

        <div className="mt-auto pt-3 border-t border-border space-y-2">
          {(() => {
            const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
            const ownerProt = (listing as any).ownerProtectionEnabled !== false;
            const { total, combinedServiceFee } = calculateTotalPrice(listing.pricePerDay, cat, 1, ownerProt);
            const deposit = calcDeposit(listing.pricePerDay);
            return (
              <>
                {/* Base price — реальный минимум за 1 сутки с учётом фонда */}
                <div className="flex items-end justify-between gap-2">
                  <div className="relative min-w-0">
                    <div
                      className="font-display font-bold text-base sm:text-xl text-primary cursor-default flex items-baseline gap-1 flex-wrap"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">от</span>
                      <span>{formatPrice(total)}</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">за сутки</span>
                      <Info className="w-3 h-3 text-primary/50 shrink-0 mb-0.5" />
                    </div>

                    {showTooltip && (
                      <div className="absolute bottom-full left-0 mb-2 z-30 bg-popover border border-border rounded-xl shadow-xl p-3 w-60 text-xs space-y-1 pointer-events-none">
                        <p className="font-bold text-foreground mb-1.5">Минимум за 1 сутки:</p>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Аренда</span><span>{formatPrice(listing.pricePerDay)}</span>
                        </div>
                        {ownerProt && combinedServiceFee > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Гарантийный фонд</span><span>{formatPrice(combinedServiceFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-border pt-1 text-foreground">
                          <span>Итого</span><span>{formatPrice(total)}</span>
                        </div>
                        <div className="flex justify-between text-amber-600 border-t border-border pt-1">
                          <span>+ залог (возвращается)</span><span>{formatPrice(deposit)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {isFree ? (
                    <button
                      type="button"
                      onClick={handleContactClick}
                      className="bg-slate-800 hover:bg-slate-900 text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1 font-bold transition-colors"
                      title="Купить контакт владельца и связаться напрямую"
                    >
                      <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      Связаться{contactPrice > 0 ? ` — ${contactPrice} ₽` : ""}
                    </button>
                  ) : (
                    <Link
                      href={`/listings/${listing.id}`}
                      className="btn-primary py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0"
                    >
                      Подробнее
                    </Link>
                  )}
                </div>

                {/* Бейджи — отличительные метки объявления */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {badges.map(b => {
                      const Icon = b.icon;
                      return (
                        <span
                          key={b.key}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] sm:text-[11px] font-semibold ${b.className}`}
                          title={b.label}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{b.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {isFree && (
        <ContactPurchaseModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          listingId={listing.id}
          listingTitle={listing.title}
        />
      )}
    </div>
  );
}
