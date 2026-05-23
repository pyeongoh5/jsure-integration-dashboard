import {
  InfluencerAuthResponseSchema,
  InfluencerMeResponseSchema,
  type InfluencerAuthResponse,
  type InfluencerLoginRequest,
  type InfluencerMeResponse,
  type InfluencerSignupRequest,
} from "@jsure/shared";
import { api } from "../api";

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
