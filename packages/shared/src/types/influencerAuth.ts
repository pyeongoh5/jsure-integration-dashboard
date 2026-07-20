import { z } from "zod";
import {
  InfluencerBankAccountSchema,
  InfluencerSnsAccountInputSchema,
  InfluencerSnsAccountSchema,
  ConsentItemSchema,
  InfluencerBankAccountPublicSchema,
  InfluencerAddressSchema,
} from "./influencer.js";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

/** YYYY-MM-DD (DateOnly) — 1900-01-01 이후, 미래 X. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BirthDateSchema = z
  .string()
  .regex(DATE_ONLY_RE, "YYYY-MM-DD 形式で入力してください")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const year = d.getUTCFullYear();
    return year >= 1900 && d.getTime() <= Date.now();
  }, "正しい生年月日を入力してください");

export const InfluencerSignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(KANA_RE, "カナで入力してください"),
  phone: z.string().min(10).max(20),
  birthDate: BirthDateSchema,
  address: InfluencerAddressSchema,
  snsAccounts: z
    .array(InfluencerSnsAccountInputSchema)
    .min(1, "1つ以上のSNSアカウントを追加してください"),
  bankAccount: InfluencerBankAccountSchema,
  termsVersion: z.string(),
  agreedItems: z
    .array(ConsentItemSchema)
    .length(6)
    .refine((items) => new Set(items).size === 6, "重複した同意項目"),
});
export type InfluencerSignupRequest = z.infer<
  typeof InfluencerSignupRequestSchema
>;

export const InfluencerLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type InfluencerLoginRequest = z.infer<
  typeof InfluencerLoginRequestSchema
>;

export const PublicInfluencerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type PublicInfluencer = z.infer<typeof PublicInfluencerSchema>;

export const InfluencerAuthResponseSchema = z.object({
  accessToken: z.string(),
  /** 회전형 리프레시 토큰 — /influencer-auth/refresh 로 액세스 토큰 갱신에 사용 */
  refreshToken: z.string(),
  influencer: PublicInfluencerSchema,
});
export type InfluencerAuthResponse = z.infer<
  typeof InfluencerAuthResponseSchema
>;

export const InfluencerRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type InfluencerRefreshRequest = z.infer<
  typeof InfluencerRefreshRequestSchema
>;

export const InfluencerRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type InfluencerRefreshResponse = z.infer<
  typeof InfluencerRefreshResponseSchema
>;

export const InfluencerLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type InfluencerLogoutRequest = z.infer<
  typeof InfluencerLogoutRequestSchema
>;

export const InfluencerMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  nameKana: z.string().nullable(),
  phone: z.string(),
  birthDate: z.string().regex(DATE_ONLY_RE).nullable(),
  address: InfluencerAddressSchema.nullable(),
  snsAccounts: z.array(InfluencerSnsAccountSchema),
  bankAccount: InfluencerBankAccountPublicSchema.nullable(),
});
export type InfluencerMeResponse = z.infer<typeof InfluencerMeResponseSchema>;

export const UpdateInfluencerProfileRequestSchema = z.object({
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(KANA_RE),
  phone: z.string().min(10).max(20),
});
export type UpdateInfluencerProfileRequest = z.infer<
  typeof UpdateInfluencerProfileRequestSchema
>;

export const UpdateInfluencerAddressRequestSchema = InfluencerAddressSchema;
export type UpdateInfluencerAddressRequest = z.infer<
  typeof UpdateInfluencerAddressRequestSchema
>;

export const LineCompleteSignupRequestSchema = z.object({
  signupToken: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).max(72).optional(),
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(KANA_RE, "カナで入力してください"),
  phone: z.string().min(10).max(20),
  birthDate: BirthDateSchema,
  address: InfluencerAddressSchema,
  snsAccounts: z
    .array(InfluencerSnsAccountInputSchema)
    .min(1, "1つ以上のSNSアカウントを追加してください"),
  bankAccount: InfluencerBankAccountSchema,
  termsVersion: z.string(),
  agreedItems: z
    .array(ConsentItemSchema)
    .length(6)
    .refine((items) => new Set(items).size === 6, "重複した同意項目"),
});
export type LineCompleteSignupRequest = z.infer<
  typeof LineCompleteSignupRequestSchema
>;

export const LineSignupTokenPayloadSchema = z.object({
  lineUserId: z.string(),
  displayName: z.string().nullable(),
});
export type LineSignupTokenPayload = z.infer<
  typeof LineSignupTokenPayloadSchema
>;
