import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";

/**
 * Работает как useState, но автоматически сохраняет значение в sessionStorage.
 * Значение восстанавливается при возврате на страницу в рамках той же сессии браузера.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) return JSON.parse(saved) as T;
    } catch {}
    return defaultValue;
  });

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}

export function clearPersistedState(...keys: string[]) {
  try { keys.forEach(k => sessionStorage.removeItem(k)); } catch {}
}

export function readPersistedState<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) return JSON.parse(saved) as T;
  } catch {}
  return fallback;
}
