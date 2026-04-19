import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Listing } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/ListingCard";
import { cn } from "@/lib/utils";
import { useRegion } from "@/lib/region-context";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface ListingCarouselSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: { label: string; className: string };
  sort: "new" | "popular" | "rating" | "price_asc";
  catalogLink?: string;
  limit?: number;
  bgClassName?: string;
}

async function fetchListings(sort: string, limit: number, region?: string): Promise<Listing[]> {
  const params = new URLSearchParams({ sort, limit: String(limit) });
  if (region) params.set("region", region);
  const res = await fetch(`${API_BASE}/api/listings?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.listings ?? [];
}

type GeoMode = "regional" | "mixed" | "fallback" | "all";

function useListings(sort: string, limit: number, region: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoMode, setGeoMode] = useState<GeoMode>("all");

  useEffect(() => {
    setLoading(true);

    const run = async () => {
      if (!region) {
        const all = await fetchListings(sort, limit);
        setListings(all);
        setGeoMode("all");
        return;
      }

      // 1. Пробуем региональные
      const regional = await fetchListings(sort, limit, region);

      if (regional.length === 0) {
        // Нет ни одного — полный фолбэк на все регионы
        const all = await fetchListings(sort, limit);
        setListings(all);
        setGeoMode("fallback");
        return;
      }

      if (regional.length >= limit) {
        // Полностью заполнен регион
        setListings(regional);
        setGeoMode("regional");
        return;
      }

      // 2. Есть, но меньше limit — добираем из всех регионов
      const all = await fetchListings(sort, limit);
      const regionalIds = new Set(regional.map((l) => l.id));
      const extra = all.filter((l) => !regionalIds.has(l.id));
      const combined = [...regional, ...extra].slice(0, limit);
      setListings(combined);
      setGeoMode("mixed");
    };

    run()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort, limit, region]);

  return { listings, loading, geoMode };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 h-full">
      <div className="aspect-[4/3] bg-muted" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-9 bg-muted rounded-xl w-24" />
        </div>
      </div>
    </div>
  );
}

export function ListingCarouselSection({
  title,
  subtitle,
  icon,
  badge,
  sort,
  catalogLink,
  limit = 8,
  bgClassName = "bg-white",
}: ListingCarouselSectionProps) {
  const { selectedRegion } = useRegion();
  const { listings, loading, geoMode } = useListings(sort, limit, selectedRegion);

  const seeAllLink = catalogLink
    ? selectedRegion && geoMode !== "fallback"
      ? `${catalogLink}${catalogLink.includes("?") ? "&" : "?"}region=${selectedRegion}`
      : catalogLink
    : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [listings, checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-card]")?.clientWidth ?? 280;
    el.scrollBy({ left: direction === "left" ? -(cardWidth + 16) * 2 : (cardWidth + 16) * 2, behavior: "smooth" });
  };

  const skeletonCount = limit > 6 ? 6 : limit;

  const geoHint =
    selectedRegion && !loading
      ? geoMode === "regional"
        ? { text: "Показываем по вашему региону", accent: false }
        : geoMode === "mixed"
        ? { text: "Сначала из вашего региона, остальное — по всей России", accent: false }
        : geoMode === "fallback"
        ? { text: "В вашем регионе пока нет предложений — показываем по всей России", accent: true }
        : null
      : null;

  return (
    <section className={cn("py-12", bgClassName)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="text-2xl leading-none select-none">{icon}</span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
                {badge && (
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", badge.className)}>
                    {badge.label}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Назад"
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center transition-all",
                canScrollLeft
                  ? "border-border bg-white hover:bg-muted hover:border-primary/50 shadow-sm text-foreground"
                  : "border-border/30 bg-muted/30 text-muted-foreground cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Вперёд"
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center transition-all",
                canScrollRight
                  ? "border-border bg-white hover:bg-muted hover:border-primary/50 shadow-sm text-foreground"
                  : "border-border/30 bg-muted/30 text-muted-foreground cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {seeAllLink && (
              <Link
                href={seeAllLink}
                className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline ml-1"
              >
                Смотреть все
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Geo hint */}
        {geoHint && (
          <div className={cn(
            "flex items-center gap-1.5 mb-4 text-xs",
            geoHint.accent ? "text-amber-600" : "text-muted-foreground"
          )}>
            <MapPin className={cn("w-3.5 h-3.5 flex-shrink-0", geoHint.accent ? "text-amber-500" : "text-primary")} />
            <span>{geoHint.text}</span>
          </div>
        )}

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} data-card className="flex-none w-[260px] sm:w-[280px]">
                  <SkeletonCard />
                </div>
              ))
            : listings.map((listing) => (
                <div key={listing.id} data-card className="flex-none w-[260px] sm:w-[280px]">
                  <ListingCard listing={listing} />
                </div>
              ))}
        </div>

        {/* Mobile "see all" */}
        {seeAllLink && (
          <div className="mt-4 text-center sm:hidden">
            <Link href={seeAllLink} className="btn-secondary text-sm py-2 px-6">
              Смотреть все
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
