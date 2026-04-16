import { useState, useEffect } from 'react';

const TOKEN_KEY = 'hochu_to_auth_token';

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

// Custom hook to reactively track auth state across components
export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());

  useEffect(() => {
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
    removeToken();
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('auth-change'));
  };

  return { isAuthenticated, login, logout, token: getToken() };
}
