import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, Heart, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites-context";

const TABS = [
  { path: "/",          label: "Главная",    icon: Home },
  { path: "/catalog",   label: "Каталог",    icon: LayoutGrid },
  { path: "/favorites", label: "Избранное",  icon: Heart },
  { path: "/dashboard?tab=messages", label: "Сообщения", icon: MessageSquare },
  { path: "/dashboard", label: "Профиль",    icon: User },
];

export function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuthState();
  const { favoriteIds } = useFavorites();
  const favCount = favoriteIds.size;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-border shadow-lg"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch h-14">
        {TABS.map(({ path, label, icon: Icon }) => {
          const basePath = path.split("?")[0];
          const isActive =
            basePath === "/" ? location === "/" : location.startsWith(basePath);
          const needAuth  = basePath === "/dashboard" || basePath === "/favorites";
          const isFavs    = basePath === "/favorites";
          const isMsgs    = label === "Сообщения";
          const badge     = isFavs && favCount > 0 ? favCount : null;
          const href      = needAuth && !isAuthenticated ? "/auth" : path;

          return (
            <Link
              key={path}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 relative select-none transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-primary rounded-b-full" />
              )}
              <div className="relative">
                <Icon className={cn("w-5 h-5 transition-all", isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
                {badge != null && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[9px] font-semibold leading-none", isActive ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
