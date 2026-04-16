import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Heart, MapPin, Star, Search, Loader2, Trash2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useAuthState } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites-context";
import { formatPrice } from "@/lib/utils";
import { ListingPlaceholder } from "@/components/ui/ListingPlaceholder";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface FavoriteListing {
  id: number;
  favoriteId: number;
  favoritedAt: string;
  title: string;
  photos: string[];
  pricePerDay: number;
  deposit: number | null;
  isAvailable: boolean;
  categoryName?: string;
  regionName?: string;
  ownerName?: string;
  ownerId: number;
  rating: number | null;
}

function getPhotoSrc(url: string) {
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export default function Favorites() {
  const { isAuthenticated } = useAuthState();
  const { toggle } = useFavorites();
  const [listings, setListings] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setListings(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const handleRemove = async (listingId: number) => {
    await toggle(listingId);
    setListings(prev => prev.filter(l => l.id !== listingId));
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
          <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center">
            <Heart className="w-10 h-10 text-rose-300" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Избранное</h2>
            <p className="text-muted-foreground mb-6">Войдите, чтобы сохранять понравившиеся вещи</p>
            <Link href="/auth" className="btn-primary px-6 py-2.5 rounded-xl">Войти</Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Избранное</h1>
            {!loading && (
              <p className="text-sm text-muted-foreground">
                {listings.length === 0 ? "Нет сохранённых объявлений" : `${listings.length} объявлений`}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <Heart className="w-12 h-12 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">Пока ничего не сохранено</p>
            <p className="text-muted-foreground text-sm max-w-sm">
              Нажмите на сердечко на карточке объявления, чтобы добавить в избранное
            </p>
            <Link href="/catalog" className="btn-primary px-6 py-2.5 rounded-xl mt-2 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(listing => {
              const hasPhoto = listing.photos.length > 0;
              const photoUrl = hasPhoto ? getPhotoSrc(listing.photos[0]) : null;
              return (
                <div key={listing.id} className="card-hover group relative flex flex-col h-full">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-bold rounded-full text-foreground shadow-sm">
                      {listing.categoryName || "Категория"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemove(listing.id)}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white hover:bg-rose-600 transition-all shadow-sm"
                    title="Удалить из избранного"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>

                  <Link href={`/listings/${listing.id}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {hasPhoto && photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <ListingPlaceholder categoryName={listing.categoryName} />
                      )}
                      {!listing.isAvailable && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="px-4 py-2 bg-white text-foreground font-bold rounded-xl shadow-lg">Сдано</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-5 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-bold text-lg leading-tight line-clamp-2">{listing.title}</h3>
                      <div className="flex items-center gap-1 text-sm font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-md shrink-0">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {listing.rating ? listing.rating.toFixed(1) : "Новое"}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{listing.regionName || "Регион не указан"}</span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <div>
                        <div className="font-display font-bold text-xl text-primary">
                          {formatPrice(listing.pricePerDay)}
                        </div>
                        <div className="text-xs text-muted-foreground">за сутки</div>
                        {listing.deposit && listing.deposit > 0 && (
                          <div className="text-xs text-muted-foreground">залог {formatPrice(listing.deposit)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemove(listing.id)}
                          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                          title="Удалить из избранного"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/listings/${listing.id}`} className="btn-primary py-2 px-4 rounded-xl text-sm whitespace-nowrap">
                          Подробнее
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
