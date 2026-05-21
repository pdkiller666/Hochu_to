import { Link, useLocation, useSearch } from "wouter";
import { MapPin, Menu, X, LogOut, Crosshair, Loader2, Bell, Heart, Shield, Search, ChevronRight, LayoutGrid, ChevronDown, Plus, LayoutDashboard, Users } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthState, getToken, getAuthHeaders } from "@/lib/auth";
import { useGetCurrentUser, useGetRegions } from "@workspace/api-client-react";
import { AppNotification } from "@workspace/api-client-react";
import { useWs } from "@/lib/use-websocket";
import { cn } from "@/lib/utils";
import { useRegion, getCachedGeoRegion, detectLocationByServerGeoIP } from "@/lib/region-context";
import { useFavorites } from "@/lib/favorites-context";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getNotifLink(type: string, bookingId?: number): string {
  switch (type) {
    case "booking_submitted":                  return "/dashboard?tab=outgoing";
    case "booking_created":                    return "/dashboard?tab=incoming";
    case "booking_confirmed":                  return "/dashboard?tab=outgoing";
    case "booking_active":                     return "/dashboard?tab=outgoing";
    case "booking_return_pending":             return "/dashboard?tab=incoming";
    case "booking_rejected":                   return "/dashboard?tab=outgoing";
    case "booking_cancelled":                  return "/dashboard?tab=incoming";
    case "booking_completed":                  return "/dashboard?tab=history";
    case "reminder_confirm_pending":           return "/dashboard";
    case "reminder_handover_today":            return "/dashboard";
    case "reminder_handover_overdue":          return "/dashboard";
    case "reminder_return_today":              return "/dashboard?tab=outgoing";
    case "reminder_return_overdue":            return "/dashboard";
    case "reminder_return_confirm":            return "/dashboard";
    case "auto_cancelled":                     return "/dashboard?tab=incoming";
    case "auto_activated":                     return "/dashboard?tab=incoming";
    case "auto_completed":                     return "/dashboard?tab=history";
    case "digital_act_countersign_required":   return "/dashboard?tab=incoming";
    case "new_booking_message":
      return bookingId ? `/dashboard?tab=incoming&chat=${bookingId}` : "/dashboard?tab=incoming";
    default:                                   return "/dashboard";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} д назад`;
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

interface SearchBarProps {
  className?: string;
  inputClassName?: string;
}

/**
 * HeaderSearchBar — owns its OWN input state.
 *
 * Why: previously the parent <Header> owned `searchQuery`. Every keystroke
 * caused Header to re-render the entire tree (auth, regions, notifications,
 * etc.), which on mobile browsers (especially iOS Safari / Chrome) caused
 * the input to lose focus and the keyboard to dismiss after each character.
 *
 * Now: input state lives here. Typing only re-renders this small component.
 * URL `?search=` is read on mount + on pathname changes (so navigating from
 * the header to /catalog?search=foo or vice versa pre-fills the input).
 */
type DropdownItem =
  | { kind: "listing"; id: number; title: string; photo?: string; pricePerDay: number; regionName?: string }
  | { kind: "category"; slug: string; name: string; count: number }
  | { kind: "search"; query: string };

function HeaderSearchBar({ className, inputClassName }: SearchBarProps) {
  const [location, navigate] = useLocation();
  const searchStr = useSearch();
  const { region: currentRegion } = useRegion();
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search") || "";
  });
  const lastNavValue = useRef(value);
  const [dropItems, setDropItems] = useState<DropdownItem[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loadingDrop, setLoadingDrop] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(searchStr);
    const urlV = sp.get("search") || "";
    setValue(urlV);
    lastNavValue.current = urlV;
  }, [searchStr, location]);

  useEffect(() => {
    if (location !== "/catalog") return;
    const q = value.trim();
    if (q === lastNavValue.current) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      if (q) sp.set("search", q); else sp.delete("search");
      lastNavValue.current = q;
      navigate(`/catalog?${sp.toString()}`, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [value, location, navigate]);

  // Autocomplete dropdown
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setDropItems([]); setShowDrop(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingDrop(true);
      try {
        // Сначала запрашиваем из текущего региона, потом всё остальное
        const regionParam = currentRegion ? `&region=${encodeURIComponent(currentRegion)}` : "";
        const [listResLocal, listResAll, catRes] = await Promise.all([
          currentRegion
            ? fetch(`${API_BASE}/api/listings?search=${encodeURIComponent(q)}${regionParam}&limit=4`).then(r => r.json())
            : Promise.resolve(null),
          fetch(`${API_BASE}/api/listings?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()),
          fetch(`${API_BASE}/api/categories`).then(r => r.json()),
        ]);
        if (cancelled) return;
        // Merge: local first (deduped), then global
        const toItem = (l: any) => ({ kind: "listing" as const, id: l.id, title: l.title, photo: l.photos?.[0], pricePerDay: Number(l.pricePerDay), regionName: l.regionName });
        const localItems = ((listResLocal?.listings ?? listResLocal?.data ?? listResLocal ?? []) as any[]).map(toItem);
        const localIds = new Set(localItems.map((l: any) => l.id));
        const globalItems = ((listResAll.listings ?? listResAll.data ?? listResAll) as any[]).map(toItem).filter((l: any) => !localIds.has(l.id));
        const listings: DropdownItem[] = [...localItems, ...globalItems].slice(0, 4);
        const cats: DropdownItem[] = (catRes as any[])
          .filter(c => c.name?.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 2)
          .map(c => ({ kind: "category" as const, slug: c.slug, name: c.name, count: c.listingCount ?? 0 }));
        const items: DropdownItem[] = [...cats, ...listings];
        if (items.length > 0) items.push({ kind: "search", query: q });
        setDropItems(items.length > 0 ? items : [{ kind: "search", query: q }]);
        setShowDrop(true);
      } catch {
        setDropItems([{ kind: "search", query: value.trim() }]);
        setShowDrop(true);
      } finally {
        if (!cancelled) setLoadingDrop(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, currentRegion]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    const sp = new URLSearchParams(window.location.search);
    if (q) sp.set("search", q); else sp.delete("search");
    lastNavValue.current = q;
    setShowDrop(false);
    navigate(`/catalog?${sp.toString()}`);
  };

  const pick = (item: DropdownItem) => {
    setShowDrop(false);
    if (item.kind === "listing") { navigate(`/listings/${item.id}`); return; }
    if (item.kind === "category") {
      const sp = new URLSearchParams();
      sp.set("category", item.slug);
      navigate(`/catalog?${sp.toString()}`);
      return;
    }
    lastNavValue.current = item.query;
    navigate(`/catalog?search=${encodeURIComponent(item.query)}`);
  };

  return (
    <div ref={wrapRef} className={cn("relative min-w-0", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 group w-full" role="search">
        {loadingDrop
          ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          : <Search className="w-4 h-4 text-muted-foreground flex-shrink-0 group-focus-within:text-primary transition-colors" />
        }
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => { if (dropItems.length > 0) setShowDrop(true); }}
          onKeyDown={e => { if (e.key === "Escape") { setShowDrop(false); inputRef.current?.blur(); } }}
          placeholder="Найти вещь для аренды..."
          className={cn("flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground appearance-none [&::-webkit-search-cancel-button]:hidden min-w-0", inputClassName)}
        />
        <button
          type="button"
          onClick={() => { setValue(""); setShowDrop(false); }}
          aria-label="Очистить"
          tabIndex={-1}
          className={cn(
            "text-muted-foreground hover:text-foreground transition-opacity flex-shrink-0",
            value ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button type="submit" className="btn-primary py-1.5 px-4 text-xs rounded-lg flex-shrink-0 hidden md:block">
          Найти
        </button>
      </form>

      <AnimatePresence>
        {showDrop && dropItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.13 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-border shadow-2xl z-[60] overflow-hidden"
            style={{ minWidth: 260 }}
          >
            {dropItems.map((item, idx) => {
              if (item.kind === "category") return (
                <button key={`cat-${item.slug}`} onClick={() => pick(item)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border/40 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.count > 0 ? `${item.count} объявлений` : "Категория"}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
              if (item.kind === "listing") return (
                <button key={`lst-${item.id}`} onClick={() => pick(item)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/60 transition-colors text-left border-b border-border/40 last:border-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.photo
                      ? <img src={item.photo.startsWith("http") ? item.photo : `${API_BASE}${item.photo.split("#")[0]}`} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-muted" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(item.pricePerDay).toLocaleString("ru")} ₽/сут
                      {item.regionName ? ` • ${item.regionName}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
              return (
                <button key="search-all" onClick={() => pick(item)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors text-left border-t border-border/60">
                  <Search className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">Найти «{item.query}» в каталоге</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, logout, token } = useAuthState();
  const [geoLoading, setGeoLoading] = useState(false);

  const { favoriteIds } = useFavorites();
  const favCount = favoriteIds.size;

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const { isConnected, subscribe } = useWs();

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {}
  }, [token]);

  // Stage 34: fetch on mount and whenever WS reconnects (catches missed events)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
  }, [isAuthenticated, fetchNotifications, isConnected]);

  // Stage 34: push new notifications from WS (no more polling)
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribe("NEW_NOTIFICATION", (payload) => {
      const notif = payload as AppNotification;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
    });
  }, [isAuthenticated, subscribe]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    if (!token) return;
    await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markOneRead = async (id: number) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const { data: user } = useGetCurrentUser({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: isAuthenticated } as any,
  });
  const { data: regions } = useGetRegions();
  const { selectedRegion: selectedSlug, setSelectedRegion, selectedCityName, setSelectedCity, clearSelectedCity } = useRegion();

  // Вычисляем текущий slug региона (приоритет: профиль → гео-кеш → "")
  const userRegionSlug = user?.regionId && regions
    ? regions.find(r => r.id === user.regionId)?.slug ?? ""
    : "";
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (!regions?.length) return;
    if (isAuthenticated && !user) return; // ждём загрузки профиля

    // Если в контексте уже стоит регион (из кеша при инициализации провайдера
    // или выбран пользователем) — не трогаем, чтобы навигация не сбрасывала выбор.
    if (selectedSlug) {
      initialized.current = true;
      return;
    }

    const preferred = userRegionSlug || getCachedGeoRegion() || "";
    if (preferred) {
      setSelectedRegion(preferred);
      initialized.current = true;
      return;
    }

    // Кеша нет, профиля нет — определяем по IP через бэкенд.
    initialized.current = true;
    detectLocationByServerGeoIP(regions).then(({ regionSlug, cityName }) => {
      if (regionSlug) setSelectedRegion(regionSlug);
      if (cityName) setSelectedCity(cityName);
    });
  }, [user, regions, userRegionSlug, isAuthenticated, selectedSlug, setSelectedRegion]);

  const selectedRegionName = regions?.find(r => r.slug === selectedSlug)?.name ?? "Выберите регион";
  // Если известен конкретный город — показываем его вместо широкого региона
  const selectedName = selectedCityName || selectedRegionName;

  const handleRegionChange = (slug: string) => {
    setSelectedRegion(slug);
    // При ручной смене региона сбрасываем детальный город
    clearSelectedCity();
    if (location === "/catalog") {
      const sp = new URLSearchParams(window.location.search);
      if (slug) sp.set("region", slug); else sp.delete("region");
      sp.delete("city");
      navigate(`/catalog?${sp.toString()}`);
    }
  };

  const handleGeoDetect = () => {
    if (!navigator.geolocation || !regions?.length) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ru`,
            { headers: { "User-Agent": "HochuTo/1.0" } }
          );
          const data = await resp.json();
          const addr = data?.address ?? {};
          // Конкретный населённый пункт (приоритет: city > town > village > suburb)
          const detectedCity: string = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.county ?? "";
          // Широкий регион для фильтрации
          const state: string = addr.state ?? addr.city ?? "";
          const slug = state ? matchRegion(state, regions) : null;
          if (slug) setSelectedRegion(slug);
          if (detectedCity) setSelectedCity(detectedCity);
          if (location === "/catalog") {
            const sp = new URLSearchParams(window.location.search);
            if (slug) sp.set("region", slug); else sp.delete("region");
            if (detectedCity) sp.set("city", detectedCity); else sp.delete("city");
            navigate(`/catalog?${sp.toString()}`);
          }
        } catch {}
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

  const navLinks = [
    { name: "Каталог", path: "/catalog" },
    { name: "Как арендовать", path: "/how-to-rent" },
    { name: "Совместные покупки", path: "/pools" },
    { name: "О нас", path: "/about" },
  ];

  const ROLE_LABELS: Record<string, string> = {
    superadmin: "Суперадмин", admin: "Администратор", moderator: "Модератор",
    support: "Поддержка", arbiter: "Арбитр", owner: "Владелец", renter: "Арендатор",
  };
  const isAdmin = user ? ["superadmin","admin","moderator","support","arbiter"].includes(user.role) : false;

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-border shadow-sm">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center h-[52px] md:h-[62px] gap-2 lg:gap-3">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group mr-1">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-display font-black text-base shadow-sm group-hover:scale-105 transition-transform">
              Х_Т
            </div>
            <span className="hidden sm:block font-display font-extrabold text-[17px] tracking-tight text-foreground">
              Хочу<span className="text-primary">_То</span>
            </span>
          </Link>

          {/* Region selector — before search, like Avito */}
          <div className="hidden lg:flex items-center gap-1 flex-shrink-0 max-w-[160px] border border-border rounded-xl px-2.5 py-1.5 bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer">
            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <select
              className="bg-transparent border-none outline-none font-medium cursor-pointer appearance-none text-foreground min-w-0 flex-1 truncate text-[13px]"
              value={selectedSlug}
              onChange={(e) => handleRegionChange(e.target.value)}
              title={selectedName}
            >
              <option value="">Все регионы</option>
              {regions?.map(r => (
                <option key={r.id} value={r.slug}>{r.name}</option>
              ))}
            </select>
            <button
              onClick={handleGeoDetect}
              disabled={geoLoading}
              title="Определить по геолокации"
              className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Search bar — flex-1 on all screens */}
          <div className="flex flex-1 min-w-0 items-center bg-white border border-border md:border-2 rounded-xl px-3 py-1 md:py-1.5 shadow-sm focus-within:border-primary/60 focus-within:shadow-md transition-all h-[36px] md:h-[42px]">
            <HeaderSearchBar className="w-full min-w-0" />
          </div>

          {/* Пул-шеринг CTA — киллер-фича */}
          <Link
            href="/pools"
            className="hidden md:flex flex-shrink-0 items-center gap-1.5 px-3 lg:px-5 py-2 rounded-xl font-bold text-sm text-white whitespace-nowrap shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden group"
            style={{ background: "linear-gradient(135deg, #4A8587 0%, #2e6566 100%)" }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 pointer-events-none" />
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Совм. покупки</span>
          </Link>

          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            {isAuthenticated && user ? (
              <>
                {/* Favorites */}
                <Link
                  href="/favorites"
                  className="relative w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 transition-all flex-shrink-0"
                  title="Избранное"
                >
                  <Heart className="w-[18px] h-[18px]" />
                  {favCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {favCount > 9 ? "9+" : favCount}
                    </span>
                  )}
                </Link>

                {/* Notification Bell */}
                <div className="relative flex-shrink-0" ref={notifRef}>
                  <button
                    onClick={() => { setNotifOpen(v => !v); if (!notifOpen) fetchNotifications(); }}
                    className="relative w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
                    title="Уведомления"
                  >
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {notifOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-border shadow-xl z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                          <span className="font-bold text-sm">Уведомления</span>
                          {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-primary font-semibold hover:underline">
                              Прочитать все
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-border">
                          {notifications.length === 0 ? (
                            <div className="py-10 text-center">
                              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Нет уведомлений</p>
                            </div>
                          ) : notifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => { if (!n.isRead) markOneRead(n.id); setNotifOpen(false); navigate(getNotifLink(n.type, n.bookingId ?? undefined)); }}
                              className={cn("w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors", !n.isRead && "bg-primary/5")}
                            >
                              <div className="flex items-start gap-2">
                                {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                                <div className={cn("flex-1 min-w-0", n.isRead && "pl-4")}>
                                  <p className="text-sm font-semibold leading-snug line-clamp-2">{n.title}</p>
                                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>}
                                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {notifications.length > 0 && (
                          <div className="border-t border-border px-4 py-2.5">
                            <Link href="/dashboard" onClick={() => setNotifOpen(false)} className="text-xs text-primary font-semibold hover:underline">
                              Перейти в личный кабинет →
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Profile dropdown */}
                <div className="relative flex-shrink-0 ml-0.5" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden lg:block text-sm font-semibold max-w-[90px] truncate text-foreground">
                      {user.name.split(" ")[0]}
                    </span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.13 }}
                        className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-border shadow-xl z-50 overflow-hidden"
                      >
                        {/* User info */}
                        <div className="px-4 py-3 bg-muted/30 border-b border-border">
                          <div className="font-bold text-sm text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</div>
                        </div>
                        {/* Links */}
                        <div className="p-1.5">
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-sm font-medium text-foreground"
                          >
                            <LayoutDashboard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            Личный кабинет
                          </Link>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/10 transition-colors text-sm font-semibold text-primary"
                            >
                              <Shield className="w-4 h-4 flex-shrink-0" />
                              Панель администратора
                            </Link>
                          )}
                          <div className="my-1 border-t border-border/60" />
                          {navLinks.map(link => (
                            <Link
                              key={link.path}
                              href={link.path}
                              onClick={() => setUserMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-sm font-medium",
                                location === link.path ? "text-primary" : "text-foreground"
                              )}
                            >
                              {link.name}
                            </Link>
                          ))}
                          <div className="my-1 border-t border-border/60" />
                          <button
                            onClick={() => { logout(); setUserMenuOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
                          >
                            <LogOut className="w-4 h-4 flex-shrink-0" />
                            Выйти
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth" className="px-4 py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Войти
                </Link>
                <Link href="/auth?tab=register" className="btn-primary py-2 px-4 rounded-xl text-sm">
                  Регистрация
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: heart + bell + hamburger */}
          <div className="md:hidden flex items-center">
            {isAuthenticated && (
              <>
                <Link
                  href="/favorites"
                  className="relative p-2 text-foreground"
                  title="Избранное"
                >
                  <Heart className="w-[18px] h-[18px]" />
                  {favCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {favCount > 9 ? "9+" : favCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => { setMobileNotifOpen(v => !v); setIsMobileMenuOpen(false); }}
                  className="relative p-2 text-foreground"
                  title="Уведомления"
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => { setIsMobileMenuOpen(v => !v); setMobileNotifOpen(false); }}
              className="text-foreground p-2 -mr-1"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>


      {/* Mobile Notification Panel — separate from nav menu */}
      <AnimatePresence>
        {mobileNotifOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-white overflow-hidden shadow-lg"
          >
            <div className="px-4 pt-3 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-primary" />
                  Уведомления
                  {unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary font-semibold">
                      Прочитать все
                    </button>
                  )}
                  <button onClick={() => setMobileNotifOpen(false)} className="p-1 text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Нет уведомлений</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {notifications.slice(0, 8).map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) markOneRead(n.id);
                        setMobileNotifOpen(false);
                        navigate(getNotifLink(n.type, n.bookingId ?? undefined));
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2",
                        !n.isRead ? "bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                      <div className={cn("flex-1 min-w-0", n.isRead && "pl-4")}>
                        <p className="text-sm font-semibold leading-snug">{n.title}</p>
                        {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {notifications.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <Link href="/dashboard" onClick={() => setMobileNotifOpen(false)}
                    className="text-xs text-primary font-semibold">
                    Перейти в личный кабинет →
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-card overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {/* Mobile Region */}
              <div className="py-3 flex items-center gap-2 text-sm font-medium text-muted-foreground border-b border-border/50 mb-2">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="flex-shrink-0">Регион:</span>
                <select
                  className="bg-transparent border-none outline-none font-bold text-foreground flex-1 min-w-0"
                  value={selectedSlug}
                  onChange={(e) => { handleRegionChange(e.target.value); setIsMobileMenuOpen(false); }}
                >
                  <option value="">Все регионы</option>
                  {regions?.map(r => (
                    <option key={r.id} value={r.slug}>{r.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleGeoDetect}
                  disabled={geoLoading}
                  title="Определить по геолокации"
                  className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0"
                >
                  {geoLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Crosshair className="w-4 h-4" />
                  }
                </button>
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className="block px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              <div className="pt-4 mt-2 border-t border-border/50 flex flex-col gap-3">
                {isAuthenticated && user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-border">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold">{user.name}</div>
                        <div className="text-sm text-muted-foreground">Личный кабинет</div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#C65D3B]/10 border border-[#C65D3B]/30 text-[#C65D3B] font-semibold hover:bg-[#C65D3B]/20 transition-colors"
                      >
                        <Shield className="w-5 h-5 flex-shrink-0" />
                        Панель администратора
                      </Link>
                    )}
                    <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full text-left px-3 py-3 rounded-xl text-destructive font-medium flex items-center gap-2 hover:bg-destructive/10">
                      <LogOut className="w-5 h-5" /> Выйти
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)} className="btn-secondary w-full justify-center">
                      Войти
                    </Link>
                    <Link href="/auth?tab=register" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full justify-center">
                      Зарегистрироваться
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
