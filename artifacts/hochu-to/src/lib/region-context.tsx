import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const GEO_CACHE_KEY = "hochu_to_geo_region";
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export function getCachedGeoRegion(): string {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return "";
    const { slug, ts } = JSON.parse(raw);
    if (Date.now() - ts > GEO_CACHE_TTL) { localStorage.removeItem(GEO_CACHE_KEY); return ""; }
    return slug ?? "";
  } catch { return ""; }
}

export function setCachedGeoRegion(slug: string) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ slug, ts: Date.now() })); } catch {}
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
