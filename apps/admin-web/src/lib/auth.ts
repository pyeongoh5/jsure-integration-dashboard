import {
  AuthResponseSchema,
  ListSessionsResponseSchema,
  RefreshResponseSchema,
  RegisterResponseSchema,
  type AuthResponse,
  type LoginRequest,
  type PublicAdminUser,
  type RefreshResponse,
  type RegisterRequest,
  type RegisterResponse,
  type SessionSummary,
} from "@jsure/shared";
import { api } from "./api";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "currentUser";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() || getRefreshToken());
}

export function getStoredUser(): PublicAdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicAdminUser;
  } catch {
    return null;
  }
}

function saveAuth(res: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, res.accessToken);
  localStorage.setItem(REFRESH_KEY, res.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

function saveTokens(res: RefreshResponse) {
  localStorage.setItem(TOKEN_KEY, res.accessToken);
  localStorage.setItem(REFRESH_KEY, res.refreshToken);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const res = await api.post("/auth/login", input);
  const parsed = AuthResponseSchema.parse(res.data);
  saveAuth(parsed);
  return parsed;
}

export async function register(
  input: RegisterRequest,
): Promise<RegisterResponse> {
  const res = await api.post("/auth/register", input);
  return RegisterResponseSchema.parse(res.data);
}

export async function refreshAccessToken(): Promise<RefreshResponse | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const res = await api.post(
    "/auth/refresh",
    { refreshToken },
    { skipAuthRefresh: true },
  );
  const parsed = RefreshResponseSchema.parse(res.data);
  saveTokens(parsed);
  return parsed;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await api.post(
        "/auth/logout",
        { refreshToken },
        { skipAuthRefresh: true },
      );
    } catch {
      // best-effort; clear local state regardless
    }
  }
  clearAuth();
}

export async function listMySessions(): Promise<SessionSummary[]> {
  const res = await api.get("/auth/sessions");
  return ListSessionsResponseSchema.parse(res.data).sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await api.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
}
