// ─── Centralized API client ────────────────────────────────────────────────────
// All requests route through /api/proxy/... — a Next.js server-side proxy
// that reads the httpOnly JWT cookie and forwards it as a Bearer token.
// The JWT is never accessible to browser JavaScript.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Route through the Next.js proxy — strip leading slash if present
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const proxyUrl = `/api/proxy/${normalizedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(proxyUrl, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({ message: 'Unknown server error' }));

  if (!res.ok) {
    throw new ApiError(res.status, data.message || `Request failed: ${res.status}`);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
