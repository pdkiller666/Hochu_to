import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface FavoritesContextValue {
  favoriteIds: Set<number>;
  isFavorite: (listingId: number) => boolean;
  toggle: (listingId: number) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteIds: new Set(),
  isFavorite: () => false,
  toggle: async () => {},
  isLoading: false,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchIds = useCallback(async () => {
    const token = getToken();
    if (!token) { setFavoriteIds(new Set()); return; }
    try {
      const res = await fetch(`${API_BASE}/api/favorites/ids`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const ids: number[] = await res.json();
        setFavoriteIds(new Set(ids));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchIds();
    const handler = () => fetchIds();
    window.addEventListener("auth-change", handler);
    return () => window.removeEventListener("auth-change", handler);
  }, [fetchIds]);

  const toggle = useCallback(async (listingId: number) => {
    const token = getToken();
    if (!token) return;
    const isFav = favoriteIds.has(listingId);

    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(listingId);
      else next.add(listingId);
      return next;
    });

    try {
      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE}/api/favorites/${listingId}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFavoriteIds(prev => {
          const next = new Set(prev);
          if (isFav) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      }
    } catch {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }
  }, [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite: (id) => favoriteIds.has(id), toggle, isLoading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
