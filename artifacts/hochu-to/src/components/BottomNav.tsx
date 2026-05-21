import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, Heart, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites-context";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated, token } = useAuthState();
  const { favoriteIds } = useFavorites();
  const favCount = favoriteIds.size;

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: { isRead: boolean }[] = await res.json();
        setUnreadCount(data.filter((n) => !n.isRead).length);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) { setUnreadCount(0); return; }
    fetchUnread();
  }, [isAuthenticated, fetchUnread]);

  // Слушаем WS-событие «новое уведомление» из Header (Stage 34)
  useEffect(() => {
    const handler = () => fetchUnread();
    window.addEventListener("notif-updated", handler);
    return () => window.removeEventListener("notif-updated", handler);
  }, [fetchUnread]);

  // Синхронизируем состояние с Header — когда панель закрывается из Header
  useEffect(() => {
    const handler = () => setNotifOpen(false);
    window.addEventListener("mobile-notif-closed", handler);
    return () => window.removeEventListener("mobile-notif-closed", handler);
  }, []);

  function toggleNotifications() {
    if (notifOpen) {
      window.dispatchEvent(new CustomEvent("close-mobile-notif"));
      setNotifOpen(false);
    } else {
      window.dispatchEvent(new CustomEvent("open-mobile-notif"));
      setNotifOpen(true);
    }
  }

  const TABS = [
    { path: "/",          label: "Главная",   icon: Home,       badge: null,     onClick: undefined },
    { path: "/catalog",   label: "Каталог",   icon: LayoutGrid, badge: null,     onClick: undefined },
    { path: "/favorites", label: "Избранное", icon: Heart,      badge: favCount > 0 ? favCount : null, onClick: undefined },
    { path: null,         label: "Уведомления", icon: Bell,     badge: unreadCount > 0 ? unreadCount : null, onClick: toggleNotifications },
    { path: "/dashboard", label: "Профиль",   icon: User,       badge: null,     onClick: undefined },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-border shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {TABS.map(({ path, label, icon: Icon, badge, onClick }) => {
          const basePath = path ?? "";
          const isActive = path
            ? basePath === "/"
              ? location === "/"
              : location.startsWith(basePath)
            : false;
          const needAuth = basePath === "/dashboard" || basePath === "/favorites";
          const href = path
            ? needAuth && !isAuthenticated
              ? "/auth"
              : path
            : undefined;

          const content = (
            <>
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-primary rounded-b-full" />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-all",
                    isActive ? "stroke-[2.5]" : "stroke-[1.8]",
                  )}
                />
                {badge != null && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] font-semibold leading-none",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </>
          );

          const cls = cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 relative select-none transition-colors",
            isActive ? "text-primary" : "text-muted-foreground",
          );

          if (onClick) {
            return (
              <button key={label} onClick={onClick} className={cls}>
                {content}
              </button>
            );
          }

          return (
            <Link key={label} href={href!} className={cls}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
