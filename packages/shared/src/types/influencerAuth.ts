import { z } from "zod";
import {
  InfluencerBankAccountSchema,
  InfluencerSnsAccountInputSchema,
  ConsentItemSchema,
  InfluencerBankAccountPublicSchema,
  InfluencerAddressSchema,
} from "./influencer.js";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export const InfluencerSignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(KANA_RE, "カナで入力してください"),
  phone: z.string().min(10).max(20),
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
  influencer: PublicInfluencerSchema,
});
export type InfluencerAuthResponse = z.infer<
  typeof InfluencerAuthResponseSchema
>;

export const InfluencerMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  nameKana: z.string().nullable(),
  phone: z.string(),
  snsAccounts: z.array(InfluencerSnsAccountInputSchema),
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

export const LineCompleteSignupRequestSchema = z.object({
  signupToken: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).max(72).optional(),
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(KANA_RE, "カナで入力してください"),
  phone: z.string().min(10).max(20),
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
