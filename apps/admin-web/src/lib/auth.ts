import {
  AuthResponseSchema,
  RegisterResponseSchema,
  type AuthResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  type RegisterResponse,
} from "@jsure/shared";
import { api } from "./api";

const TOKEN_KEY = "accessToken";
const USER_KEY = "currentUser";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getStoredUser(): PublicUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

function saveAuth(res: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, res.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
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

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
