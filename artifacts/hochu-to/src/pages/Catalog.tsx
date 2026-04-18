import { Layout } from "@/components/layout/Layout";
import { useGetListings, useGetCategories, useGetRegions, useGetCurrentUser } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/ListingCard";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Search, X, SlidersHorizontal, MapPin } from "lucide-react";
import { getToken, getAuthHeaders } from "@/lib/auth";
import { getCachedGeoRegion, setCachedGeoRegion, detectRegionByServerGeoIP } from "@/lib/region-context";

function matchRegion(stateName: string, regions: { name: string; slug: string }[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\u2014\u2013\-]/g, "-").replace(/\s+/g, " ").trim();
  const state = norm(stateName);
  let match = regions.find(r => norm(r.name) === state);
  if (match) return match.slug;
  match = regions.find(r => state.startsWith(norm(r.name)) || norm(r.name).startsWith(state));
  if (match) return match.slug;
  match = regions.find(r => {
    const rn = norm(r.name);
    const words = state.split(" ").filter(w => w.length > 4);
    return words.length > 0 && words.every(w => rn.includes(w));
  });
  return match?.slug ?? null;
}

async function detectRegionByGeo(regions: { name: string; slug: string }[]): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ru`,
            { headers: { "User-Agent": "HochuTo/1.0" } }
          );
          const data = await resp.json();
          const state: string = data?.address?.state ?? data?.address?.city ?? "";
          if (!state) { resolve(null); return; }
          const slug = matchRegion(state, regions);
          if (slug) setCachedGeoRegion(slug);
          resolve(slug);
        } catch { resolve(null); }
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000 }
    );
  });
}

export default function Catalog() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const urlRegion = searchParams.get("region") || "";
  const urlCategory = searchParams.get("category") || "";

  const [category, setCategory] = useState(urlCategory);
  const [region, setRegion] = useState(urlRegion || getCachedGeoRegion() || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const regionInitialized = useRef(!!(urlRegion || getCachedGeoRegion()));

  const token = getToken();
  const { data: categories } = useGetCategories();
  const { data: regions } = useGetRegions();
  const { data: currentUser } = useGetCurrentUser(
    { request: getAuthHeaders() },
    { query: { enabled: !!token } }
  );

  useEffect(() => {
    if (regionInitialized.current) return;
    if (!regions?.results?.length) return;
    if (currentUser?.regionId) {
      const userRegion = regions.results.find(r => r.id === currentUser.regionId);
      if (userRegion) {
        setRegion(userRegion.slug);
        setCachedGeoRegion(userRegion.slug);
        regionInitialized.current = true;
        return;
      }
    }

    const detectGeo = async () => {
      let slug = await detectRegionByGeo(regions.results);
      if (!slug) {
        slug = await detectRegionByServerGeoIP(regions.results);
      }
      if (slug) {
        setRegion(slug);
        setCachedGeoRegion(slug);
      }
      regionInitialized.current = true;
    };

    detectGeo();
  }, [regions?.results?.length, currentUser?.regionId]);

  const { data, isLoading, error } = useGetListings({
    category: category || undefined,
    region: region || undefined,
    search: search || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    limit: 24,
  });

  const userDefaultRegion = currentUser?.regionId
    ? regions?.results?.find(r => r.id === currentUser.regionId)?.slug ?? ""
    : "";

  const resetFilters = () => {
    setCategory("");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setRegion("");
  };

  const hasActiveFilters = !!(category || search || minPrice || maxPrice);
  const selectedRegionName = regions?.results?.find(r => r.slug === region)?.name ?? "";

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Каталог вещей</h1>
          <p className="text-muted-foreground">
            {data ? `Найдено ${data.total} предложений` : "Загрузка..."}
            {selectedRegionName && (
              <span className="ml-1">· <span className="text-primary font-medium">{selectedRegionName}</span></span>
            )}
          </p>
        </div>

        {/* Category Pills */}
        <div className="mb-5 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2 scrollbar-hide no-scrollbar" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setCategory("")}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${
                category === ""
                  ? "bg-primary text-white border-primary shadow-md"
                  : "bg-white text-foreground border-border hover:border-primary hover:text-primary"
              }`}
            >
              Все категории
            </button>
            {categories?.results && categories.results.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(category === c.slug ? "" : c.slug)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${
                  category === c.slug
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-white text-foreground border-border hover:border-primary hover:text-primary"
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Region */}
          <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl px-3 py-2.5 min-w-[160px]">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); regionInitialized.current = true; }}
              className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer appearance-none w-full"
            >
              <option value="">Все регионы</option>
              {regions?.results?.map(r => (
                <option key={r.id} value={r.slug}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Price filter toggle */}
          <button
            onClick={() => setShowPriceFilter(!showPriceFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              showPriceFilter || minPrice || maxPrice
                ? "bg-primary/10 border-primary text-primary"
                : "bg-white border-border hover:border-primary hover:text-primary"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Цена{minPrice || maxPrice ? `: ${minPrice || "0"} – ${maxPrice || "∞"} ₽` : ""}
          </button>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent transition-all"
            >
              <X className="w-4 h-4" /> Сбросить
            </button>
          )}
        </div>

        {/* Price Range (expandable) */}
        {showPriceFilter && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-white border border-border rounded-2xl w-fit">
            <span className="text-sm font-bold text-muted-foreground">Цена за сутки (₽):</span>
            <input
              type="number"
              placeholder="От"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-24 px-3 py-2 bg-muted border border-transparent rounded-xl text-sm focus:bg-white focus:border-primary outline-none"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="number"
              placeholder="До"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-24 px-3 py-2 bg-muted border border-transparent rounded-xl text-sm focus:bg-white focus:border-primary outline-none"
            />
            <button
              onClick={() => setShowPriceFilter(false)}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Готово
            </button>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p>Ищем лучшие предложения...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-6 rounded-2xl border border-destructive/20 text-center">
            <p className="font-bold text-lg mb-2">Упс! Произошла ошибка</p>
            <p>Не удалось загрузить каталог. Попробуйте обновить страницу.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="bg-white border border-border p-12 rounded-2xl text-center flex flex-col items-center justify-center">
            <Search className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Ничего не найдено</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              По вашим фильтрам нет подходящих вещей. Попробуйте изменить параметры поиска или выбрать другую категорию.
            </p>
            <button onClick={resetFilters} className="btn-secondary">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data?.results && data.results.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="mt-12 flex justify-center gap-2">
                <button className="px-4 py-2 border border-border rounded-xl disabled:opacity-50" disabled>Назад</button>
                <span className="px-4 py-2 bg-primary text-white rounded-xl font-bold">1</span>
                <button className="px-4 py-2 border border-border rounded-xl">Вперед</button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
