import { Layout } from "@/components/layout/Layout";
import { useGetListings, useGetCategories, useGetRegions, useGetCurrentUser } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/ListingCard";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Search, X, SlidersHorizontal, MapPin, Loader2, ChevronDown, ChevronUp, ArrowUpDown, ShieldCheck, LayoutGrid, Rows3, Banknote } from "lucide-react";
import { getToken, getAuthHeaders } from "@/lib/auth";
import { getCachedGeoRegion, setCachedGeoRegion, detectRegionByServerGeoIP, useRegion } from "@/lib/region-context";
import { readPersistedState, clearPersistedState } from "@/lib/use-persisted-state";
import { useDocumentMeta } from "@/lib/use-document-meta";

const STORAGE_KEY = "catalog_filters";

type SortOption = "new" | "popular" | "rating" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "new", label: "Новые" },
  { value: "popular", label: "Популярные" },
  { value: "rating", label: "По рейтингу" },
  { value: "price_asc", label: "Цена ↑" },
  { value: "price_desc", label: "Цена ↓" },
];

interface SavedFilters {
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  showPriceFilter?: boolean;
  safeOnly?: boolean;
}

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
  useDocumentMeta({
    title: "Каталог аренды",
    description: "Тысячи объявлений аренды вещей по всей России. Инструменты, техника, туристическое снаряжение, электроника и многое другое — безопасно и выгодно.",
  });

  const [viewMode, setViewMode] = useState<"grid" | "mosaic">("grid");

  const [location] = useLocation();
  const searchStr = useSearch();

  // URL-параметры имеют приоритет над sessionStorage
  const searchParams = new URLSearchParams(window.location.search);
  const urlRegion = searchParams.get("region") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlSort = searchParams.get("sort") || "";
  const urlSafeOnly = searchParams.get("safeOnly") === "1" || searchParams.get("safeOnly") === "true";

  // Восстанавливаем сохранённые фильтры (если нет URL-параметров)
  const saved = readPersistedState<SavedFilters>(STORAGE_KEY, {});

  const { setSelectedRegion: setHeaderRegion } = useRegion();

  const [category, setCategory] = useState(urlCategory || saved.category || "");
  const [region, setRegionLocal] = useState(urlRegion || getCachedGeoRegion() || "");
  // Обёртка: обновляем и локальный стейт, и контекст шапки одновременно.
  const setRegion = (slug: string) => {
    setRegionLocal(slug);
    setHeaderRegion(slug);
  };
  const [search, setSearch] = useState(urlSearch || saved.search || "");
  const [minPrice, setMinPrice] = useState(saved.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(saved.maxPrice || "");
  const [sort, setSort] = useState<SortOption>((urlSort || saved.sort || "new") as SortOption);
  const [showPriceFilter, setShowPriceFilter] = useState(saved.showPriceFilter ?? false);
  const [safeOnly, setSafeOnly] = useState<boolean>(urlSafeOnly || saved.safeOnly || false);
  const [showFilters, setShowFilters] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const regionInitialized = useRef(!!(urlRegion || getCachedGeoRegion()));

  const token = getToken();
  const { data: categories } = useGetCategories();
  const { data: regions } = useGetRegions();
  const { data: currentUser } = useGetCurrentUser({
    request: { headers: getAuthHeaders() as Record<string, string> },
    query: { enabled: !!token } as any,
  });

  // Сохраняем фильтры в sessionStorage при каждом изменении
  useEffect(() => {
    try {
      const toSave: SavedFilters = { category, search, minPrice, maxPrice, sort, showPriceFilter, safeOnly };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [category, search, minPrice, maxPrice, sort, showPriceFilter, safeOnly]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync search/category/region from URL when navigating (e.g. from header search).
  // Depends on searchStr so it reacts even when only ?search= changes (pathname stays /catalog).
  useEffect(() => {
    const sp = new URLSearchParams(searchStr);
    const s = sp.get("search") || "";
    const c = sp.get("category") || "";
    const r = sp.get("region") || "";
    setSearch(s);
    if (c) setCategory(c);
    if (r) { setRegion(r); regionInitialized.current = true; }
  }, [location, searchStr]);

  useEffect(() => {
    if (regionInitialized.current) return;
    if (!regions?.length) return;
    if (currentUser?.regionId) {
      const userRegion = regions.find(r => r.id === currentUser.regionId);
      if (userRegion) {
        setRegion(userRegion.slug);
        setCachedGeoRegion(userRegion.slug);
        regionInitialized.current = true;
        return;
      }
    }

    const detectGeo = async () => {
      let slug = await detectRegionByGeo(regions);
      if (!slug) slug = await detectRegionByServerGeoIP(regions);
      if (slug) { setRegion(slug); setCachedGeoRegion(slug); }
      regionInitialized.current = true;
    };
    detectGeo();
  }, [regions?.length, currentUser?.regionId]);

  const { data, isLoading, error } = useGetListings({
    category: category || undefined,
    region: region || undefined,
    search: search || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    sort: sort || undefined,
    safeOnly: safeOnly ? "true" : undefined,
    limit: 24,
  } as Parameters<typeof useGetListings>[0]);

  const resetFilters = () => {
    setCategory("");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setSort("new");
    setRegion("");
    setSafeOnly(false);
    clearPersistedState(STORAGE_KEY);
  };

  const hasActiveFilters = !!(category || search || minPrice || maxPrice || (sort && sort !== "new") || safeOnly);
  const selectedRegionName = regions?.find(r => r.slug === region)?.name ?? "";
  const selectedCategoryName = categories?.find(c => c.slug === category)?.name ?? "";
  const selectedSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";
  const activeFiltersCount = [
    region,
    category,
    minPrice || maxPrice ? "price" : "",
    sort && sort !== "new" ? sort : "",
    safeOnly ? "safe" : "",
  ].filter(Boolean).length;

  return (
    <Layout>
      {/* ── Sticky filter bar ── */}
      <div
        className={`sticky top-[114px] md:top-16 z-30 bg-background/95 backdrop-blur-md transition-shadow duration-200 ${
          isScrolled ? "shadow-md border-b border-border/80" : "border-b border-border/40"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Toggle bar + карусель категорий в одну строку */}
          <div className="py-2 flex items-center gap-2 min-w-0">
            {/* Кнопка фильтров — фиксированная слева */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-white border-border text-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Фильтры</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Разделитель */}
            <div className="flex-shrink-0 w-px h-5 bg-border" />

            {/* Карусель категорий — скроллится вправо */}
            <div className="flex gap-1.5 overflow-x-auto flex-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] py-0.5">
              <button
                onClick={() => setCategory("")}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap ${
                  !category
                    ? "bg-primary text-white border-primary"
                    : "bg-white border-border hover:border-primary hover:text-primary text-foreground"
                }`}
              >
                Все
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(category === cat.slug ? "" : cat.slug)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap ${
                    category === cat.slug
                      ? "bg-primary text-white border-primary"
                      : "bg-white border-border hover:border-primary hover:text-primary text-foreground"
                  }`}
                >
                  {(cat as any).icon && <span>{(cat as any).icon}</span>}
                  <span>{cat.name}</span>
                  {(cat as any).listingCount > 0 && (
                    <span className="opacity-60">{(cat as any).listingCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Сбросить — прижат к правому краю */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent transition-all"
                title="Сбросить все фильтры"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Сбросить</span>
              </button>
            )}
          </div>

          {/* ── Сворачиваемая панель фильтров ── */}
          {showFilters && (
          <>
          <div className="pb-2">
            <div className="flex gap-2 items-center">

              {/* Region — hidden on xs, shown sm+ */}
              <div className="hidden sm:flex items-center gap-1.5 bg-white border border-border rounded-xl px-3 py-2.5 min-w-[140px] max-w-[180px]">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <select
                  value={region}
                  onChange={(e) => { setRegion(e.target.value); regionInitialized.current = true; }}
                  className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer appearance-none w-full truncate"
                >
                  <option value="">Все регионы</option>
                  {regions?.map(r => (
                    <option key={r.id} value={r.slug}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Sort dropdown */}
              <div className="hidden sm:flex items-center gap-1.5 bg-white border border-border rounded-xl px-3 py-2.5 min-w-[130px]">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer appearance-none w-full"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Safe-deals toggle */}
              <button
                onClick={() => setSafeOnly(v => !v)}
                aria-pressed={safeOnly}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all flex-shrink-0 ${
                  safeOnly
                    ? "bg-green-50 border-green-500 text-green-700"
                    : "bg-white border-border text-foreground hover:border-green-500 hover:text-green-700"
                }`}
                title="Показать только объявления с защитой сделки"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Безопасные сделки</span>
                <span className="sm:hidden">Безопасные</span>
              </button>

              {/* Price button */}
              <button
                onClick={() => setShowPriceFilter(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all flex-shrink-0 ${
                  showPriceFilter || minPrice || maxPrice
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-white border-border text-foreground hover:border-primary hover:text-primary"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {minPrice || maxPrice ? `${minPrice || "0"}–${maxPrice || "∞"} ₽` : "Цена"}
                </span>
                {(minPrice || maxPrice) && (
                  <span className="sm:hidden w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* Price range — expandable */}
            {showPriceFilter && (
              <div className="mt-2 flex flex-wrap items-center gap-2 p-3 bg-white border border-border rounded-xl">
                <span className="text-xs font-bold text-muted-foreground">Цена за сутки (₽):</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    placeholder="От"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-muted border border-transparent rounded-lg text-sm focus:bg-white focus:border-primary outline-none"
                  />
                  <span className="text-muted-foreground text-sm">—</span>
                  <input
                    type="number"
                    placeholder="До"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-muted border border-transparent rounded-lg text-sm focus:bg-white focus:border-primary outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowPriceFilter(false)}
                  className="text-sm text-primary font-semibold hover:underline flex-shrink-0"
                >
                  Готово
                </button>
              </div>
            )}
          </div>

          {/* Mobile: region + sort row */}
          <div className="sm:hidden pb-2 flex gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl px-3 py-2 flex-1">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); regionInitialized.current = true; }}
                className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer appearance-none w-full"
              >
                <option value="">Все регионы</option>
                {regions?.map(r => (
                  <option key={r.id} value={r.slug}>{r.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl px-3 py-2 flex-1">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer appearance-none w-full"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          </>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Page header */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-0.5">Каталог вещей</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `Найдено ${data.total} предложений` : "Загрузка..."}
              {selectedRegionName && (
                <span className="ml-1">
                  · <span className="text-primary font-medium">{selectedRegionName}</span>
                </span>
              )}
            </p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 shadow-sm flex-shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              title="Обычная сетка"
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("mosaic")}
              title="Мозаика"
              className={`p-1.5 rounded-lg transition-all ${viewMode === "mosaic" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Rows3 className="w-4 h-4" />
            </button>
          </div>
        </div>

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
        ) : !data?.listings?.length ? (
          <>
            {/* Сообщение: в выбранном регионе ничего нет */}
            <div className="bg-white border border-border p-8 sm:p-10 rounded-2xl text-center flex flex-col items-center justify-center">
              <Search className="w-14 h-14 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">
                {selectedRegionName
                  ? `В регионе «${selectedRegionName}» таких вещей пока нет`
                  : "Ничего не найдено"}
              </h3>
              <p className="text-muted-foreground mb-5 max-w-md">
                {selectedRegionName
                  ? "Попробуйте изменить параметры поиска, выбрать другую категорию или регион."
                  : "По вашим фильтрам нет подходящих вещей. Попробуйте изменить параметры."}
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                {selectedRegionName && (
                  <button
                    onClick={() => { setRegion(""); regionInitialized.current = true; }}
                    className="btn-primary"
                  >
                    Искать во всех регионах
                  </button>
                )}
                <button onClick={resetFilters} className="btn-secondary">
                  Сбросить фильтры
                </button>
              </div>
            </div>

            {/* Объявления из других регионов (если есть) */}
            {(data as any)?.otherRegionsListings?.length > 0 && (
              <div className="mt-10">
                <div className="mb-5 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Похожие в других регионах</h2>
                    <p className="text-sm text-muted-foreground">
                      Возможно, вам подойдут эти предложения
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {(data as any).otherRegionsListings.map((listing: any) => (
                    <ListingCard key={`other-${listing.id}`} listing={listing} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {data.listings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              /* Мозаика: каждая 1-я и 6-я карточки в группе по 6 занимают 2 колонки */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {data.listings.map((listing, idx) => {
                  const pos = idx % 6;
                  const isWide = pos === 0 || pos === 5;
                  return (
                    <div
                      key={listing.id}
                      className={isWide ? "col-span-2" : "col-span-1"}
                    >
                      <ListingCard listing={listing} />
                    </div>
                  );
                })}
              </div>
            )}

            {data.totalPages > 1 && (
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
