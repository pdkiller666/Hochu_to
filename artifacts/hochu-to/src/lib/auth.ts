import { useState, useEffect } from 'react';

const TOKEN_KEY = 'hochu_to_auth_token';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      return null;
    }
    setToken(data.token);
    window.dispatchEvent(new Event('auth-change'));
    return data.token;
  } catch {
    return null;
  }
}

export async function logoutEverywhere(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch {
    // Ignore network errors; local logout still proceeds.
  } finally {
    removeToken();
    window.dispatchEvent(new Event('auth-change'));
  }
}

// Custom hook to reactively track auth state across components
export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());

  useEffect(() => {
    const bootstrapRefresh = async () => {
      if (!getToken()) return;
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        removeToken();
      }
      setIsAuthenticated(!!getToken());
    };
    void bootstrapRefresh();

    const handleStorageChange = () => {
      setIsAuthenticated(!!getToken());
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener('auth-change', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
    };
  }, []);

  const login = (token: string) => {
    setToken(token);
    setIsAuthenticated(true);
    window.dispatchEvent(new Event('auth-change'));
  };

  const logout = () => {
    void logoutEverywhere();
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout, token: getToken() };
}
