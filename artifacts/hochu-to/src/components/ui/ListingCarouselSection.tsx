import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Listing } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/ListingCard";
import { cn } from "@/lib/utils";
import { useRegion } from "@/lib/region-context";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const SPEED_PX_S = 48; // pixels per second — smooth, not distracting

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

  // Duplicate for seamless looping (like Ticker)
  const track = [...listings, ...listings];

  const seeAllLink = catalogLink
    ? selectedRegion && geoMode !== "fallback"
      ? `${catalogLink}${catalogLink.includes("?") ? "&" : "?"}region=${selectedRegion}`
      : catalogLink
    : undefined;

  // GPU-smooth auto-scroll via transform
  const outerRef = useRef<HTMLDivElement>(null);   // overflow:hidden wrapper
  const trackRef = useRef<HTMLDivElement>(null);   // flex track we translate
  const posRef   = useRef(0);                      // current X position (float)
  const lastTsRef = useRef(0);
  const isPausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const startRaf = useCallback(() => {
    const tick = (ts: number) => {
      if (!isPausedRef.current) {
        const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 80) : 0;
        lastTsRef.current = ts;

        const tr = trackRef.current;
        if (tr) {
          const half = tr.scrollWidth / 2; // half because we duplicated
          if (half > 0) {
            posRef.current += (SPEED_PX_S * dt) / 1000;
            if (posRef.current >= half) posRef.current -= half;
            tr.style.transform = `translate3d(-${posRef.current}px, 0, 0)`;
          }
        }
      } else {
        lastTsRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (loading || listings.length === 0) return;
    startRaf();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [loading, listings, startRaf]);

  // Manual scroll buttons — move posRef by 2 card widths
  const scroll = (dir: "left" | "right") => {
    const tr = trackRef.current;
    if (!tr) return;
    const card = tr.querySelector<HTMLElement>("[data-card]");
    const step = (card ? card.offsetWidth : 280) + 16; // card + gap
    const half = tr.scrollWidth / 2;
    if (half <= 0) return;
    posRef.current += dir === "right" ? step * 2 : -(step * 2);
    posRef.current = ((posRef.current % half) + half) % half; // wrap
    tr.style.transform = `translate3d(-${posRef.current}px, 0, 0)`;
  };

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

  const hasItems = !loading && listings.length > 0;

  return (
    <section className={cn("py-12 overflow-x-clip", bgClassName)}>
      {/* Header */}
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
              disabled={!hasItems}
              aria-label="Назад"
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center transition-all",
                hasItems
                  ? "border-border bg-white hover:bg-muted hover:border-primary/50 shadow-sm text-foreground"
                  : "border-border/30 bg-muted/30 text-muted-foreground cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!hasItems}
              aria-label="Вперёд"
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center transition-all",
                hasItems
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

      {/* Carousel track — overflow:hidden + translate3d for GPU smoothness */}
      <div
        ref={outerRef}
        className="overflow-hidden px-4 sm:px-6 lg:px-8 mt-1 pb-3"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; lastTsRef.current = 0; }}
        onTouchStart={() => { isPausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { isPausedRef.current = false; lastTsRef.current = 0; }, 2500); }}
      >
        {loading ? (
          /* Skeleton — static flex row */
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} data-card className="flex-none w-[260px] sm:w-[280px]">
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : (
          /* Live track — GPU-translated */
          <div
            ref={trackRef}
            className="flex gap-4"
            style={{ willChange: "transform", transform: "translate3d(0,0,0)" }}
          >
            {track.map((listing, i) => (
              <div key={`${listing.id}-${i}`} data-card className="flex-none w-[260px] sm:w-[280px]">
                <ListingCard listing={listing} />
              </div>
            ))}
          </div>
        )}
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
