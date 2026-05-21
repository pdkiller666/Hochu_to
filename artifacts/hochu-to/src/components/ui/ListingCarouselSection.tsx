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
  quality?: boolean;
}

async function fetchListings(sort: string, limit: number, region?: string, quality?: boolean): Promise<Listing[]> {
  const params = new URLSearchParams({ sort, limit: String(limit) });
  if (region) params.set("region", region);
  if (quality) params.set("quality", "true");
  const res = await fetch(`${API_BASE}/api/listings?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.listings ?? [];
}

type GeoMode = "regional" | "mixed" | "fallback" | "all";

function useListings(sort: string, limit: number, region: string, quality?: boolean) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoMode, setGeoMode] = useState<GeoMode>("all");

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      if (!region) {
        setListings(await fetchListings(sort, limit, undefined, quality));
        setGeoMode("all");
        return;
      }
      const regional = await fetchListings(sort, limit, region, quality);
      if (regional.length === 0) {
        setListings(await fetchListings(sort, limit, undefined, quality));
        setGeoMode("fallback");
        return;
      }
      if (regional.length >= limit) {
        setListings(regional);
        setGeoMode("regional");
        return;
      }
      const all = await fetchListings(sort, limit, undefined, quality);
      const regionalIds = new Set(regional.map((l) => l.id));
      setListings([...regional, ...all.filter((l) => !regionalIds.has(l.id))].slice(0, limit));
      setGeoMode("mixed");
    };
    run().catch(() => {}).finally(() => setLoading(false));
  }, [sort, limit, region, quality]);

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

const SCROLL_SPEED = 0.6; // px per animation frame

export function ListingCarouselSection({
  title,
  subtitle,
  icon,
  badge,
  sort,
  catalogLink,
  limit = 8,
  bgClassName = "bg-white",
  quality,
}: ListingCarouselSectionProps) {
  const { selectedRegion } = useRegion();
  const { listings, loading, geoMode } = useListings(sort, limit, selectedRegion, quality);

  const seeAllLink = catalogLink
    ? selectedRegion && geoMode !== "fallback"
      ? `${catalogLink}${catalogLink.includes("?") ? "&" : "?"}region=${selectedRegion}`
      : catalogLink
    : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isPausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const skipFramesRef = useRef(0);

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

  // Auto-scroll loop
  useEffect(() => {
    if (loading || listings.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    const tick = () => {
      if (!isPausedRef.current && el) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0) {
          if (skipFramesRef.current > 0) {
            // waiting for browser to settle after reset
            skipFramesRef.current--;
          } else if (el.scrollLeft >= maxScroll - 1) {
            // reached end — jump to start and pause for 20 frames
            el.scrollLeft = 0;
            skipFramesRef.current = 20;
          } else {
            el.scrollLeft += SCROLL_SPEED;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loading, listings]);

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
    <section className={cn("py-12 overflow-x-clip", bgClassName)}>
      {/* Header — stays within max-width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && <span className="text-2xl leading-none select-none">{icon}</span>}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
                {badge && (
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", badge.className)}>
                    {badge.label}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
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

        {geoHint && (
          <div className={cn(
            "flex items-center gap-1.5 mb-3 text-xs",
            geoHint.accent ? "text-amber-600" : "text-muted-foreground"
          )}>
            <MapPin className={cn("w-3.5 h-3.5 flex-shrink-0", geoHint.accent ? "text-amber-500" : "text-primary")} />
            <span>{geoHint.text}</span>
          </div>
        )}
      </div>

      {/* Scrollable row — full-width with internal padding, no right-edge clip */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 scroll-smooth px-4 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
        onTouchStart={() => { isPausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { isPausedRef.current = false; }, 3000); }}
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
        {/* Right-edge spacer so last card isn't flush with viewport */}
        <div className="flex-none w-4 sm:w-6 lg:w-8 shrink-0" aria-hidden />
      </div>

      {seeAllLink && (
        <div className="mt-4 text-center sm:hidden px-4">
          <Link href={seeAllLink} className="btn-secondary text-sm py-2 px-6">
            Смотреть все
          </Link>
        </div>
      )}
    </section>
  );
}
