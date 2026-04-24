import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "betaBannerDismissedAt";
const HIDE_FOR_HOURS = 24;

/**
 * Stage 21a — Глобальный sticky-баннер бета-режима.
 * Показывается, если `/api/settings.isCommercialMode === false`.
 * Закрывается на сутки (через localStorage).
 */
export default function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const dismissed = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
        if (dismissed && Date.now() - dismissed < HIDE_FOR_HOURS * 3600_000) return;
        const r = await fetch("/api/settings");
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (j?.isCommercialMode === false) setVisible(true);
      } catch {
        /* silently ignore */
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  // Не показываем баннер на админ-страницах
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return null;

  return (
    <div className="sticky top-0 z-[60] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-stone-900 border-b border-amber-500 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        <div className="text-sm sm:text-[15px] font-medium leading-snug">
          🛡 Платформа работает в режиме бета-тестирования. Все функции платформы бесплатны!
        </div>
        <button
          aria-label="Закрыть"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, String(Date.now()));
            setVisible(false);
          }}
          className="p-1 rounded-md hover:bg-amber-500/30 transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
