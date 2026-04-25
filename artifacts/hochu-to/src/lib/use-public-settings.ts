import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface PublicSettings {
  contactPriceSingle: number;
  contactPricePack10: number;
  contactPriceUnlimited30d: number;
  freeContactsBonus: number;
  contactLifetimeDays: number;
  freeShowOwnerPhoneMode: string;
  freeListingsEnabled: boolean;
  /**
   * Главный «коммерческий рубильник». false = Бета-режим:
   * никаких комиссий, фонда, эскроу и платных контактов — UI скрывает
   * соответствующие блоки, оплата аренды происходит напрямую владельцу.
   */
  isCommercialMode: boolean;
  [key: string]: any;
}

let cache: { data: PublicSettings | null; ts: number; promise: Promise<PublicSettings> | null } = {
  data: null,
  ts: 0,
  promise: null,
};
const TTL_MS = 60_000;

async function fetchPublicSettings(): Promise<PublicSettings> {
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL_MS) return cache.data;
  if (cache.promise) return cache.promise;
  cache.promise = fetch(`${API_BASE}/api/settings`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error("settings_fetch_failed")))
    .then((data: PublicSettings) => {
      cache.data = data;
      cache.ts = Date.now();
      cache.promise = null;
      return data;
    })
    .catch(err => {
      cache.promise = null;
      throw err;
    });
  return cache.promise;
}

/** Хук с client-side кэшированием публичных настроек платформы (TTL 60с).
 * При сетевой ошибке — экспоненциальный retry (1s, 2s, 4s, до 30с) до успеха.
 * Это критично: компоненты используют tri-state (loading=commercial-default,
 * явный false=beta), и постоянный null от единичного фейла даст ложно-commercial
 * UI в beta-deploy до перезагрузки страницы. */
export function usePublicSettings(): PublicSettings | null {
  const [data, setData] = useState<PublicSettings | null>(cache.data);
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryLoad = () => {
      fetchPublicSettings()
        .then(d => { if (!cancelled) setData(d); })
        .catch(() => {
          if (cancelled) return;
          attempt += 1;
          const delay = Math.min(30_000, 1000 * Math.pow(2, attempt - 1));
          timer = setTimeout(tryLoad, delay);
        });
    };
    tryLoad();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);
  return data;
}
