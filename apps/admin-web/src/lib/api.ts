import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { RefreshResponseSchema } from "@jsure/shared";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "currentUser";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await axios.post(
      `${api.defaults.baseURL ?? ""}/auth/refresh`,
      { refreshToken },
      { timeout: 10_000 },
    );
    const parsed = RefreshResponseSchema.parse(res.data);
    localStorage.setItem(TOKEN_KEY, parsed.accessToken);
    localStorage.setItem(REFRESH_KEY, parsed.refreshToken);
    return parsed.accessToken;
  } catch {
    return null;
  }
}

function forceLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  const onAuthPage =
    window.location.pathname === "/login" ||
    window.location.pathname === "/register";
  if (!onAuthPage) {
    window.location.assign("/login");
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) {
      return Promise.reject(err);
    }
    const original = err.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    if (!original || original.skipAuthRefresh || original._retried) {
      if (!original?.skipAuthRefresh) forceLogout();
      return Promise.reject(err);
    }
    original._retried = true;

    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    const newToken = await refreshInFlight;
    if (!newToken) {
      forceLogout();
      return Promise.reject(err);
    }
    original.headers.Authorization = `Bearer ${newToken}`;
    return api.request(original as AxiosRequestConfig);
  },
);
