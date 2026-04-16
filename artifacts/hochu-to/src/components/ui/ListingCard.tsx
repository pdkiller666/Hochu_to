import { Link } from "wouter";
import { MapPin, Star, Heart } from "lucide-react";
import { Listing } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { useState } from "react";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";
import { useFavorites } from "@/lib/favorites-context";
import { getToken } from "@/lib/auth";
import { useLocation } from "wouter";

interface ListingCardProps {
  listing: Listing;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getPhotoSrc(url: string) {
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export function ListingCard({ listing }: ListingCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasPhoto = (listing.photos?.length ?? 0) > 0 && !imgError;
  const photoUrl = listing.photos?.[0] ? getPhotoSrc(listing.photos[0]) : null;
  const { isFavorite, toggle } = useFavorites();
  const [, navigate] = useLocation();
  const fav = isFavorite(listing.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!getToken()) { navigate("/auth"); return; }
    toggle(listing.id);
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
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="font-bold text-lg leading-tight line-clamp-2" title={listing.title}>
            {listing.title}
          </h3>
          <div className="flex items-center gap-1 text-sm font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-md shrink-0">
            <Star className="w-3.5 h-3.5 fill-current" />
            {listing.rating ? listing.rating.toFixed(1) : "Новое"}
          </div>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {(listing as any).city
              ? `${(listing as any).city}, ${listing.regionName || ""}`
              : listing.regionName || "Регион не указан"}
          </span>
        </div>

        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-xl text-primary">
              {formatPrice(listing.pricePerDay)}
            </div>
            <div className="text-xs text-muted-foreground">за сутки</div>
          </div>

          <Link href={`/listings/${listing.id}`} className="btn-primary py-2 px-4 rounded-xl text-sm whitespace-nowrap">
            Подробнее
          </Link>
        </div>
      </div>
    </div>
  );
}
