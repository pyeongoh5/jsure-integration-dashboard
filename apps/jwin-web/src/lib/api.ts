export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { status: res.status });
  return res.json() as Promise<T>;
}

export function userLoginUrl(redirectTo: string): string {
  return `${API_BASE}/oauth/user/start?redirectTo=${encodeURIComponent(redirectTo)}`;
}
