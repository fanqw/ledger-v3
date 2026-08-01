import { useAuth } from './auth';

type AuthState = ReturnType<typeof useAuth>;

let globalAuth: AuthState | null = null;
const inFlightGetRequests = new Map<string, Promise<Response>>();

export function setGlobalAuth(auth: AuthState) {
  globalAuth = auth;
}

async function performAuthFetch(url: string, options: RequestInit): Promise<Response> {
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

function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (Object.keys(options).length > 0) {
    return performAuthFetch(url, options).then((response) => {
      const method = options.method?.toUpperCase() || 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        inFlightGetRequests.clear();
      }
      return response;
    });
  }

  const requestKey = `${globalAuth?.accessToken || ''}:${url}`;
  let request = inFlightGetRequests.get(requestKey);
  if (!request) {
    request = performAuthFetch(url, options);
    inFlightGetRequests.set(requestKey, request);
    const clearRequest = () => {
      if (inFlightGetRequests.get(requestKey) === request) {
        inFlightGetRequests.delete(requestKey);
      }
    };
    request.then(clearRequest, clearRequest);
  }

  return request.then((response) => response.clone());
}

export { authFetch };
