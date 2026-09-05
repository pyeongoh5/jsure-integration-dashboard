import axios, {
  AxiosError,
  type AxiosInstance,
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

/**
 * 대시보드 API (@jsure/api). 인증(로그인·refresh)의 주체는 항상 이쪽이다.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10_000,
});

/**
 * J-WIN API (@jsure/jwin-api). DB는 분리돼 있지만 인증은 대시보드 토큰을 그대로 쓴다 (D-10).
 * jwin-api 는 같은 JWT_SECRET 으로 서명만 검증하므로 별도 로그인이 없다.
 * dev 에서는 vite 프록시(/jwin-api → localhost:8080)를 타고,
 * 운영에서는 VITE_JWIN_API_BASE_URL 로 Railway 도메인을 직접 가리킨다.
 */
export const jwinApi = axios.create({
  baseURL: import.meta.env.VITE_JWIN_API_BASE_URL || "/jwin-api",
  timeout: 10_000,
});

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    // refresh 는 언제나 대시보드 API 로 나간다 (jwin-api 는 토큰을 발급하지 않는다)
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

/**
 * access token 주입 + 401 시 1회 refresh 후 재시도.
 * 두 인스턴스가 같은 `refreshInFlight` 를 공유하므로 동시 401 이 나도 갱신은 한 번만 나간다.
 */
function attachAuthInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
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
      return instance.request(original as AxiosRequestConfig);
    },
  );
}

attachAuthInterceptors(api);
attachAuthInterceptors(jwinApi);

/** API 에러 응답에서 사용자에게 보여줄 메시지를 뽑아낸다. NestJS 는 message 를 문자열 또는 배열로 내려준다. */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)
      ?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
    if (Array.isArray(message) && typeof message[0] === "string") {
      return message[0];
    }
  }
  return error instanceof Error ? error.message : fallback;
}
