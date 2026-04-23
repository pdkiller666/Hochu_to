import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const GEO_CACHE_KEY = "hochu_to_geo_region";
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
// Версия формата кеша. Бамп = одноразовая инвалидация у всех клиентов.
// v2 — после фикса "вечной Москвы" из-за фолбэка backend /api/geoip на local IP.
const GEO_CACHE_VERSION = 2;

export function getCachedGeoRegion(): string {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const { slug, ts, v } = parsed;
    if (v !== GEO_CACHE_VERSION) { localStorage.removeItem(GEO_CACHE_KEY); return ""; }
    if (Date.now() - ts > GEO_CACHE_TTL) { localStorage.removeItem(GEO_CACHE_KEY); return ""; }
    return slug ?? "";
  } catch { return ""; }
}

export function setCachedGeoRegion(slug: string) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ slug, ts: Date.now(), v: GEO_CACHE_VERSION })); } catch {}
}

// Определяет регион по IP пользователя через наш бэкенд /api/geoip.
// Бэкенд сам сопоставляет город с регионом из БД и возвращает regionSlug.
export async function detectRegionByServerGeoIP(
  _regions: { name: string; slug: string }[]
): Promise<string | null> {
  try {
    const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL || "";
    const resp = await fetch(`${API_BASE}/api/geoip`, { credentials: "include" });
    if (!resp.ok) return null;
    const data = await resp.json() as { regionSlug?: string | null; error?: string };
    return data.regionSlug ?? null;
  } catch {
    return null;
  }
}

interface RegionContextValue {
  selectedRegion: string;
  setSelectedRegion: (slug: string) => void;
}

const RegionContext = createContext<RegionContextValue>({
  selectedRegion: "",
  setSelectedRegion: () => {},
});

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegionState] = useState<string>(() => getCachedGeoRegion());

  const setSelectedRegion = useCallback((slug: string) => {
    setSelectedRegionState(slug);
    setCachedGeoRegion(slug);
  }, []);

  return (
    <RegionContext.Provider value={{ selectedRegion, setSelectedRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
