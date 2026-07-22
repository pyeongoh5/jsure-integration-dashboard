import {
  InfluencerAuthResponseSchema,
  InfluencerMeResponseSchema,
  type InfluencerAuthResponse,
  type InfluencerLoginRequest,
  type InfluencerMeResponse,
  type InfluencerSignupRequest,
  type LineCompleteSignupRequest,
} from "@jsure/shared";
import { api, REFRESH_STORAGE_KEY } from "@/lib/api";

export async function signup(
  input: InfluencerSignupRequest,
): Promise<InfluencerAuthResponse> {
  const res = await api.post("/influencer-auth/signup", input);
  return InfluencerAuthResponseSchema.parse(res.data);
}

export async function login(
  input: InfluencerLoginRequest,
): Promise<InfluencerAuthResponse> {
  const res = await api.post("/influencer-auth/login", input);
  return InfluencerAuthResponseSchema.parse(res.data);
}

export async function fetchMe(): Promise<InfluencerMeResponse> {
  const res = await api.get("/influencer-auth/me");
  return InfluencerMeResponseSchema.parse(res.data);
}

export async function lineCompleteSignup(
  input: LineCompleteSignupRequest,
): Promise<InfluencerAuthResponse> {
  const res = await api.post("/influencer-auth/line/complete-signup", input);
  return InfluencerAuthResponseSchema.parse(res.data);
}

// 서버 세션(리프레시 토큰) 폐기. 실패해도 로컬 로그아웃은 진행되므로 무시.
export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_STORAGE_KEY);
  if (!refreshToken) return;
  try {
    await api.post("/influencer-auth/logout", { refreshToken });
  } catch {
    // 서버 폐기 실패는 무시 — 만료로 어차피 무효화된다
  }
}

export function lineAuthorizeUrl(): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.origin}/api`;
  return `${base}/influencer-auth/line/authorize`;
}
