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

// Определяет регион по IP пользователя через наш бэкенд /api/geoip.
// Бэкенд берёт реальный IP из заголовков Amvera-прокси и обращается к ip-api.com / ipwho.is.
export async function detectRegionByServerGeoIP(
  regions: { name: string; slug: string }[]
): Promise<string | null> {
  try {
    const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL || "";
    const resp = await fetch(`${API_BASE}/api/geoip`, { credentials: "include" });
    if (!resp.ok) return null;

    const data = await resp.json() as { city?: string; error?: string };
    if (!data.city) return null;

    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[\u2014\u2013\-]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    const city = norm(data.city);

    // Точное совпадение
    let match = regions.find(r => norm(r.name) === city);
    if (match) return match.slug;

    // Частичное совпадение (город содержит название региона или наоборот)
    match = regions.find(r => city.includes(norm(r.name)) || norm(r.name).includes(city));
    if (match) return match.slug;

    // По ключевым словам длиннее 4 символов
    match = regions.find(r => {
      const rn = norm(r.name);
      const words = city.split(" ").filter(w => w.length > 4);
      return words.length > 0 && words.some(w => rn.includes(w));
    });

    return match?.slug ?? null;
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
