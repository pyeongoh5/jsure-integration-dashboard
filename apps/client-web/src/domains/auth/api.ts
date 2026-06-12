import {
  InfluencerAuthResponseSchema,
  InfluencerMeResponseSchema,
  type InfluencerAuthResponse,
  type InfluencerLoginRequest,
  type InfluencerMeResponse,
  type InfluencerSignupRequest,
  type LineCompleteSignupRequest,
} from "@jsure/shared";
import { api } from "@/lib/api";

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

export function lineAuthorizeUrl(): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.origin}/api`;
  return `${base}/influencer-auth/line/authorize`;
}
