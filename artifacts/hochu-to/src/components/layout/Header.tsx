import { Link, useLocation } from "wouter";
import { MapPin, Menu, X, LogOut, Crosshair, Loader2, Bell, Heart, Shield, Search } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthState, getToken, getAuthHeaders } from "@/lib/auth";
import { useGetCurrentUser, useGetRegions } from "@workspace/api-client-react";
import { AppNotification } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useRegion, getCachedGeoRegion } from "@/lib/region-context";
import { useFavorites } from "@/lib/favorites-context";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getNotifLink(type: string): string {
  switch (type) {
    case "booking_submitted":           return "/dashboard?tab=outgoing";
    case "booking_created":             return "/dashboard?tab=incoming";
    case "booking_confirmed":           return "/dashboard?tab=outgoing";
    case "booking_active":              return "/dashboard?tab=outgoing";
    case "booking_return_pending":      return "/dashboard?tab=incoming";
    case "booking_rejected":            return "/dashboard?tab=outgoing";
    case "booking_cancelled":           return "/dashboard?tab=incoming";
    case "booking_completed":           return "/dashboard?tab=history";
    case "reminder_confirm_pending":    return "/dashboard";
    case "reminder_handover_today":     return "/dashboard";
    case "reminder_handover_overdue":   return "/dashboard";
    case "reminder_return_today":       return "/dashboard?tab=outgoing";
    case "reminder_return_overdue":     return "/dashboard";
    case "reminder_return_confirm":     return "/dashboard";
    case "auto_cancelled":              return "/dashboard?tab=incoming";
    case "auto_activated":             return "/dashboard?tab=incoming";
    case "auto_completed":             return "/dashboard?tab=history";
    default:                            return "/dashboard";
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

export function Header() {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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

  const { data: user } = useGetCurrentUser(
    { request: { headers: { Authorization: `Bearer ${token}` } } },
    { query: { enabled: isAuthenticated } }
  );
  const { data: regions } = useGetRegions();
  const { selectedRegion: selectedSlug, setSelectedRegion } = useRegion();

  // Вычисляем текущий slug региона (приоритет: профиль → гео-кеш → "")
  const userRegionSlug = user?.regionId && regions
    ? regions.find(r => r.id === user.regionId)?.slug ?? ""
    : "";
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (!regions?.length) return;
    if (isAuthenticated && !user) return; // ждём загрузки профиля
    const preferred = userRegionSlug || getCachedGeoRegion() || "";
    if (preferred) {
      setSelectedRegion(preferred);
      initialized.current = true;
    }
  }, [user, regions, userRegionSlug, isAuthenticated, setSelectedRegion]);

  const selectedName = regions?.find(r => r.slug === selectedSlug)?.name ?? "Выберите регион";

  const handleRegionChange = (slug: string) => {
    setSelectedRegion(slug);
    if (location === "/catalog") {
      const sp = new URLSearchParams(window.location.search);
      if (slug) sp.set("region", slug); else sp.delete("region");
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
          const state: string = data?.address?.state ?? data?.address?.city ?? "";
          const slug = state ? matchRegion(state, regions) : null;
          if (slug) handleRegionChange(slug);
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
    { name: "Совместные покупки", path: "/joint-purchases" },
    { name: "О нас", path: "/about" },
  ];

  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/catalog?search=${encodeURIComponent(q)}`);
    else navigate("/catalog");
  };

  const SearchBar = ({ className, inputClassName }: { className?: string; inputClassName?: string }) => (
    <form onSubmit={handleSearch} className={cn("flex items-center gap-2 group", className)}>
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0 group-focus-within:text-primary transition-colors" />
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Найти вещь для аренды..."
        className={cn("flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground", inputClassName)}
      />
      {searchQuery && (
        <button type="button" onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <button type="submit" className="btn-primary py-1.5 px-4 text-xs rounded-lg flex-shrink-0">
        Найти
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center gap-3 h-16">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-display font-black text-lg shadow group-hover:scale-105 transition-transform">
              Х_Т
            </div>
            <span className="hidden sm:block font-display font-extrabold text-xl tracking-tight text-foreground">
              Хочу<span className="text-primary">_То</span>
            </span>
          </Link>

          {/* Desktop Search Bar — center, takes most space */}
          <div className="hidden md:flex flex-1 mx-2 items-center bg-muted/50 border border-border rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
            <SearchBar className="w-full" />
          </div>

          {/* Desktop Region Selector */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white shadow-sm text-sm text-muted-foreground hover:border-primary/40 transition-colors flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <select
              className="bg-transparent border-none outline-none font-medium cursor-pointer appearance-none text-foreground max-w-[120px] truncate text-sm"
              value={selectedSlug}
              onChange={(e) => handleRegionChange(e.target.value)}
              title={selectedName}
            >
              <option value="">Все регионы</option>
              {regions?.map(r => (
                <option key={r.id} value={r.slug}>{r.name}</option>
              ))}
            </select>
            <div className="w-px h-3.5 bg-border mx-0.5 flex-shrink-0" />
            <button
              onClick={handleGeoDetect}
              disabled={geoLoading}
              title="Определить регион по геолокации"
              className="p-0.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {geoLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Crosshair className="w-3.5 h-3.5" />
              }
            </button>
          </div>

          {/* Desktop Nav — only xl+ */}
          <nav className="hidden xl:flex items-center gap-6 flex-shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-primary whitespace-nowrap",
                  location === link.path ? "text-primary" : "text-foreground"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Mobile spacer */}
          <div className="flex-1 md:hidden" />

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* Favorites Heart */}
                <Link
                  href="/favorites"
                  className="relative w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground hover:border-rose-400 hover:text-rose-500 transition-all hover:shadow-md"
                  title="Избранное"
                >
                  <Heart className="w-5 h-5" />
                  {favCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {favCount > 9 ? "9+" : favCount}
                    </span>
                  )}
                </Link>

                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => { setNotifOpen(v => !v); if (!notifOpen) fetchNotifications(); }}
                    className="relative w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all hover:shadow-md"
                    title="Уведомления"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
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
                        className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-border shadow-xl z-50 overflow-hidden"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                          <span className="font-bold text-sm">Уведомления</span>
                          {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-primary font-semibold hover:underline">
                              Прочитать все
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div className="max-h-80 overflow-y-auto divide-y divide-border">
                          {notifications.length === 0 ? (
                            <div className="py-10 text-center">
                              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Нет уведомлений</p>
                            </div>
                          ) : notifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                if (!n.isRead) markOneRead(n.id);
                                setNotifOpen(false);
                                navigate(getNotifLink(n.type));
                              }}
                              className={cn(
                                "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                                !n.isRead && "bg-primary/5"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                {!n.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                )}
                                <div className={cn("flex-1 min-w-0", n.isRead && "pl-4")}>
                                  <p className="text-sm font-semibold leading-snug line-clamp-2">{n.title}</p>
                                  {n.message && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                          <div className="border-t border-border px-4 py-2.5">
                            <Link href="/dashboard" onClick={() => setNotifOpen(false)}
                              className="text-xs text-primary font-semibold hover:underline">
                              Перейти в личный кабинет →
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-border hover:border-primary transition-all group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold leading-none group-hover:text-primary transition-colors">{user.name}</span>
                    <span className="text-xs text-muted-foreground leading-none mt-1">
                      {user.role === "admin" ? "Администратор" : user.role === "owner" ? "Владелец" : "Арендатор"}
                    </span>
                  </div>
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#C65D3B]/10 text-[#C65D3B] hover:bg-[#C65D3B]/20 transition-colors">
                    Панель
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="w-10 h-10 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                  title="Выйти"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth" className="btn-secondary py-2 px-5 rounded-full text-sm">
                  Войти
                </Link>
                <Link href="/auth?tab=register" className="btn-primary py-2 px-5 rounded-full text-sm">
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
                  className="relative p-3 text-foreground"
                  title="Избранное"
                >
                  <Heart className="w-5 h-5" />
                  {favCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {favCount > 9 ? "9+" : favCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => { setMobileNotifOpen(v => !v); setIsMobileMenuOpen(false); }}
                  className="relative p-3 text-foreground"
                  title="Уведомления"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => { setIsMobileMenuOpen(v => !v); setMobileNotifOpen(false); }}
              className="text-foreground p-3 -mr-1"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Row — always visible, part of sticky header */}
      <div className="md:hidden px-3 pb-2.5">
        <div className="flex items-center bg-muted/50 border border-border rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          <SearchBar className="w-full" />
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
                        navigate(getNotifLink(n.type));
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
                    {user.role === "admin" && (
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
