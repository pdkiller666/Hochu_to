import { Link } from "wouter";
import { MapPin, Star, Heart, Info, ShieldCheck, Sparkles, Award, Flame, Crown, Zap } from "lucide-react";
import { Listing } from "@workspace/api-client-react";
import { formatPrice, calculateTotalPrice, calcDeposit, type ItemCategory } from "@/lib/utils";
import { useState } from "react";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";
import { useFavorites } from "@/lib/favorites-context";
import { getToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { usePublicSettings } from "@/lib/use-public-settings";

interface ListingCardProps {
  listing: Listing;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function parsePhotoUrl(url: string): { src: string; position: string } {
  const [src, posRaw] = url.split("#pos=");
  return {
    src: src || url,
    position: posRaw ? posRaw.replace(/_/g, " ") : "center",
  };
}

function getPhotoSrc(url: string) {
  const { src } = parsePhotoUrl(url);
  return src.startsWith("http") ? src : `${API_BASE}${src}`;
}

type Badge = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className: string;
  tier: "paid" | "earned" | "default";
};

function getListingBadges(listing: Listing, isCommercialMode: boolean): Badge[] {
  const out: Badge[] = [];
  const l = listing as any;
  const now = Date.now();

  if (isCommercialMode && l.isFeatured && (!l.featuredUntil || new Date(l.featuredUntil).getTime() > now)) {
    out.push({ key: "vip", icon: Crown, label: "VIP", className: "bg-amber-100 text-amber-800 border-amber-300", tier: "paid" });
  }
  if (isCommercialMode && l.isUrgent && (!l.urgentUntil || new Date(l.urgentUntil).getTime() > now)) {
    out.push({ key: "urgent", icon: Zap, label: "Срочно", className: "bg-red-100 text-red-700 border-red-300", tier: "paid" });
  }
  if (isCommercialMode && l.ownerProtectionEnabled !== false) {
    out.push({ key: "safe", icon: ShieldCheck, label: "Безопасная сделка", className: "bg-green-50 text-green-700 border-green-200", tier: "default" });
  }
  const rating = typeof l.rating === "number" ? l.rating : 0;
  const reviewCount = typeof l.reviewCount === "number" ? l.reviewCount : 0;
  const bookingCount = typeof l.bookingCount === "number" ? l.bookingCount : 0;
  if (rating >= 4.5 && reviewCount >= 3) {
    out.push({ key: "rating", icon: Star, label: "Высокий рейтинг", className: "bg-amber-50 text-amber-700 border-amber-200", tier: "earned" });
  }
  if (bookingCount >= 10 && rating < 4.5) {
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
  const settings = usePublicSettings();
  const isCommercialMode = settings?.isCommercialMode !== false;
  const badges = getListingBadges(listing, isCommercialMode);
  const hasPhoto = (listing.photos?.length ?? 0) > 0 && !imgError;
  const firstPhotoRaw = listing.photos?.[0] ?? "";
  const { src: photoSrc, position: photoPosition } = parsePhotoUrl(firstPhotoRaw);
  const photoUrl = hasPhoto ? (photoSrc.startsWith("http") ? photoSrc : `${API_BASE}${photoSrc}`) : null;
  const { isFavorite, toggle } = useFavorites();
  const [, navigate] = useLocation();
  const fav = isFavorite(listing.id);

  const city = (listing as any).city as string | undefined;
  const isAvailable = listing.isAvailable !== false;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!getToken()) { navigate("/auth"); return; }
    toggle(listing.id);
  };

  const handleRentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/listings/${listing.id}`);
  };

  return (
    <Link href={`/listings/${listing.id}`} className="card-hover group relative flex flex-col h-full">
      {/* Top overlay row: категория слева, сердечко справа */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-1">
        {/* Метка категории */}
        <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] font-semibold rounded-full text-foreground shadow-sm leading-4 max-w-[calc(100%-40px)] truncate">
          {listing.categoryName || "Категория"}
        </span>

        {/* Сердечко справа */}
        <button
          onClick={handleFavoriteClick}
          className={`flex-shrink-0 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all shadow-sm ${
            fav
              ? "text-rose-500 hover:text-rose-600"
              : "text-muted-foreground hover:text-rose-500 hover:bg-white"
          }`}
          title={fav ? "Удалить из избранного" : "Добавить в избранное"}
        >
          <Heart className={`w-3.5 h-3.5 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {hasPhoto && photoUrl ? (
          <img
            src={photoUrl}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ objectPosition: photoPosition }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <ListingPlaceholder categoryName={listing.categoryName ?? undefined} />
        )}

        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-4 py-2 bg-white text-foreground font-bold rounded-xl shadow-lg">Занято</span>
          </div>
        )}
        {(listing.photos?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {listing.photos!.length} фото
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1 gap-1.5">
          <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-2" title={listing.title}>
            {listing.title}
          </h3>
          {listing.rating ? (
            <div className="flex items-center gap-0.5 text-xs font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md shrink-0">
              <Star className="w-3 h-3 fill-current" />
              {listing.rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {/* M-5: City chip */}
        {city && (
          <div className="mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold rounded-full">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              {city}
            </span>
          </div>
        )}

        {(() => {
          const region = listing.regionName || "";
          const sameAsCity = city && region.trim().toLowerCase() === city.trim().toLowerCase();
          if (sameAsCity) return null;
          return (
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{region || (!city ? "Регион не указан" : "")}</span>
            </div>
          );
        })()}

        <div className="mt-auto pt-2.5 border-t border-border space-y-2">
          {(() => {
            const cat = ((listing as any).itemCategory ?? "tools") as ItemCategory;
            const ownerProt = (listing as any).ownerProtectionEnabled !== false;
            const { total: totalCommercial, combinedServiceFee } = calculateTotalPrice(listing.pricePerDay, cat, 1, ownerProt);
            const total = isCommercialMode ? totalCommercial : Number(listing.pricePerDay);
            const deposit = calcDeposit(listing.pricePerDay);
            return (
              <>
                <div className="relative min-w-0">
                  <div
                    className="font-display font-bold text-base sm:text-lg text-primary cursor-default flex items-baseline gap-1 flex-wrap"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground">от</span>
                    <span>{formatPrice(total)}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">за сутки</span>
                    <Info className="w-3 h-3 text-primary/50 shrink-0 mb-0.5" />
                  </div>

                  {showTooltip && (
                    <div className="absolute bottom-full left-0 mb-2 z-30 bg-popover border border-border rounded-xl shadow-xl p-3 w-60 text-xs space-y-1 pointer-events-none">
                      <p className="font-bold text-foreground mb-1.5">Минимум за 1 сутки:</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Аренда</span><span>{formatPrice(listing.pricePerDay)}</span>
                      </div>
                      {isCommercialMode && ownerProt && combinedServiceFee > 0 && (
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

                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {badges.map(b => {
                      const Icon = b.icon;
                      return (
                        <span
                          key={b.key}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${b.className}`}
                          title={b.label}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{b.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* M-4: Арендовать button */}
                {isAvailable && (
                  <button
                    onClick={handleRentClick}
                    className="w-full py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 mt-1"
                  >
                    Арендовать
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}
