import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  user: null, accessToken: null, loading: true,
  login: async () => {}, logout: async () => {}, refresh: async () => null,
});

export function useAuth() { return useContext(AuthContext); }

let refreshPromise: Promise<string | null> | null = null;

function hasRefreshTokenCookie() {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith('refreshTokenPresent=1'));
}

async function canRefreshSession() {
  if (hasRefreshTokenCookie()) return true;
  try {
    const res = await fetch('/api/auth/refresh-status', { credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.data?.hasRefreshToken);
  } catch {
    return false;
  }
}

function getRefreshedToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (!await canRefreshSession()) return null;
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data?.accessToken || null;
    })()
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize: refresh first (skip wasted 401 session call)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getRefreshedToken();
      if (token && !cancelled) {
        setAccessToken(token);
        try {
          const res = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            if (data?.data) setUser(data.data);
          }
        } catch {}
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.error?.message || '登录失败');
    }
    setAccessToken(data.data.accessToken);
    const sessionRes = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${data.data.accessToken}` },
      credentials: 'include',
    });
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      setUser(sessionData.data);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
    });
    setUser(null);
    setAccessToken(null);
  }, [accessToken]);

  const refresh = useCallback(async (): Promise<string | null> => {
    const newToken = await getRefreshedToken();
    if (newToken) {
      setAccessToken(newToken);
      return newToken;
    }
    setUser(null);
    setAccessToken(null);
    return null;
  }, []);

  const authValue = useMemo(
    () => ({ user, accessToken, loading, login, logout, refresh }),
    [user, accessToken, loading, login, logout, refresh],
  );

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}
