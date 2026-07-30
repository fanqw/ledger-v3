import { useAuth } from './auth';

type AuthState = ReturnType<typeof useAuth>;

let globalAuth: AuthState | null = null;
export function setGlobalAuth(auth: AuthState) {
  globalAuth = auth;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const auth = globalAuth;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (auth?.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If 401, try refresh and retry once
  if (res.status === 401 && auth) {
    const newToken = await auth.refresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  return res;
}

export { authFetch };
