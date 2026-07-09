// Shared API client for DropZone admin + customer frontends.
// Empty string = same-origin relative calls (e.g. "/api/..."), used for
// production builds where the PHP API is served from the same domain.
// Local dev overrides this via frontend/.env.local (NEXT_PUBLIC_API_BASE=http://localhost:8080).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Opts = RequestInit & { admin?: boolean; user?: { id?: number; identifier?: string } };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };

  if (opts.admin && typeof window !== 'undefined') {
    const token = localStorage.getItem('dz_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (opts.user?.id) headers['X-User-Id'] = String(opts.user.id);
  if (opts.user?.identifier) headers['X-User-Identifier'] = opts.user.identifier;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data.error || 'error', data.message || res.statusText, res.status);
  }
  return data as T;
}

// ---- Admin auth helpers ----
export function saveSession(token: string) {
  localStorage.setItem('dz_token', token);
}
export function clearSession() {
  localStorage.removeItem('dz_token');
}
export function hasSession() {
  return typeof window !== 'undefined' && !!localStorage.getItem('dz_token');
}

// ---- Customer identity (persisted locally) ----
export function saveUser(u: { id: number; identifier: string }) {
  localStorage.setItem('dz_user', JSON.stringify(u));
}
export function getUser(): { id: number; identifier: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('dz_user');
  return raw ? JSON.parse(raw) : null;
}
export function clearUser() {
  localStorage.removeItem('dz_user');
}
