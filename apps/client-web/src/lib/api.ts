import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const TOKEN_KEY = "influencerAccessToken";
const ME_KEY = "currentInfluencer";

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
export const ME_STORAGE_KEY = ME_KEY;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ME_KEY);
      const path = window.location.pathname;
      const onAuthPage = path === "/login" || path.startsWith("/signup");
      if (!onAuthPage) {
        const from = encodeURIComponent(path + window.location.search);
        window.location.assign(`/login?from=${from}`);
      }
    }
    return Promise.reject(err);
  },
);
