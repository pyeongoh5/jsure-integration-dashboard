import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const TOKEN_KEY = "influencerAccessToken";
const REFRESH_KEY = "influencerRefreshToken";
const ME_KEY = "currentInfluencer";

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
export const REFRESH_STORAGE_KEY = REFRESH_KEY;
export const ME_STORAGE_KEY = ME_KEY;

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL,
  timeout: 10_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 동시 401 들이 각자 refresh 를 치지 않도록 단일 비행으로 묶는다.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    // 인터셉터 재귀를 피하려고 api 인스턴스 대신 순수 axios 사용.
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/influencer-auth/refresh`,
      { refreshToken },
      { timeout: 10_000 },
    );
    localStorage.setItem(TOKEN_KEY, res.data.accessToken);
    localStorage.setItem(REFRESH_KEY, res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    localStorage.removeItem(REFRESH_KEY);
    return null;
  }
}

function redirectToLogin(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ME_KEY);
  const path = window.location.pathname;
  const onAuthPage = path === "/login" || path.startsWith("/signup");
  if (!onAuthPage) {
    const from = encodeURIComponent(path + window.location.search);
    window.location.assign(`/login?from=${from}`);
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as RetriableConfig | undefined;
    if (err.response?.status !== 401) {
      return Promise.reject(err);
    }
    // 액세스 토큰 만료 → 리프레시 후 원 요청 1회 재시도.
    if (config && !config._retried) {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        config._retried = true;
        config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(config);
      }
    }
    redirectToLogin();
    return Promise.reject(err);
  },
);
