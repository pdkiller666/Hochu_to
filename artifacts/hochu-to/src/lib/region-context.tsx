import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const GEO_CACHE_KEY = "hochu_to_geo_region";
const GEO_CITY_CACHE_KEY = "hochu_to_geo_city";
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
// v2 — после фикса "вечной Москвы"
const GEO_CACHE_VERSION = 2;
const GEO_CITY_CACHE_VERSION = 1;

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

export function getCachedGeoCity(): string {
  try {
    const raw = localStorage.getItem(GEO_CITY_CACHE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const { city, ts, v } = parsed;
    if (v !== GEO_CITY_CACHE_VERSION) { localStorage.removeItem(GEO_CITY_CACHE_KEY); return ""; }
    if (Date.now() - ts > GEO_CACHE_TTL) { localStorage.removeItem(GEO_CITY_CACHE_KEY); return ""; }
    return city ?? "";
  } catch { return ""; }
}

export function setCachedGeoCity(city: string) {
  try { localStorage.setItem(GEO_CITY_CACHE_KEY, JSON.stringify({ city, ts: Date.now(), v: GEO_CITY_CACHE_VERSION })); } catch {}
}

export function clearCachedGeoCity() {
  try { localStorage.removeItem(GEO_CITY_CACHE_KEY); } catch {}
}

// Определяет регион и город по IP через бэкенд /api/geoip.
export async function detectLocationByServerGeoIP(
  _regions: { name: string; slug: string }[]
): Promise<{ regionSlug: string | null; cityName: string | null }> {
  try {
    const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL || "";
    const resp = await fetch(`${API_BASE}/api/geoip`, { credentials: "include" });
    if (!resp.ok) return { regionSlug: null, cityName: null };
    const data = await resp.json() as { regionSlug?: string | null; city?: string | null; error?: string };
    return { regionSlug: data.regionSlug ?? null, cityName: data.city ?? null };
  } catch {
    return { regionSlug: null, cityName: null };
  }
}

/** @deprecated Use detectLocationByServerGeoIP */
export async function detectRegionByServerGeoIP(
  regions: { name: string; slug: string }[]
): Promise<string | null> {
  const result = await detectLocationByServerGeoIP(regions);
  return result.regionSlug;
}

interface RegionContextValue {
  selectedRegion: string;
  setSelectedRegion: (slug: string) => void;
  selectedCityName: string;
  setSelectedCity: (cityName: string) => void;
  clearSelectedCity: () => void;
}

const RegionContext = createContext<RegionContextValue>({
  selectedRegion: "",
  setSelectedRegion: () => {},
  selectedCityName: "",
  setSelectedCity: () => {},
  clearSelectedCity: () => {},
});

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegionState] = useState<string>(() => getCachedGeoRegion());
  const [selectedCityName, setSelectedCityNameState] = useState<string>(() => getCachedGeoCity());

  const setSelectedRegion = useCallback((slug: string) => {
    setSelectedRegionState(slug);
    setCachedGeoRegion(slug);
  }, []);

  const setSelectedCity = useCallback((cityName: string) => {
    setSelectedCityNameState(cityName);
    setCachedGeoCity(cityName);
  }, []);

  const clearSelectedCity = useCallback(() => {
    setSelectedCityNameState("");
    clearCachedGeoCity();
  }, []);

  return (
    <RegionContext.Provider value={{ selectedRegion, setSelectedRegion, selectedCityName, setSelectedCity, clearSelectedCity }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
