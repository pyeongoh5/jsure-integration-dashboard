import { z } from "zod";
import { normalizeSnsHandle } from "../utils/snsHandle.js";

export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

export const InfluencerEntityTypeSchema = z.enum(["INDIVIDUAL", "CORPORATE"]);
export type InfluencerEntityType = z.infer<typeof InfluencerEntityTypeSchema>;

export const JpAccountTypeSchema = z.enum(["FUTSU", "TOUZA"]);
export type JpAccountType = z.infer<typeof JpAccountTypeSchema>;

export const ConsentItemSchema = z.enum([
  "PR_LABEL",
  "DEADLINE",
  "INSIGHTS",
  "SECONDARY_USE",
  "YAKKIHO",
  "GUIDELINE",
]);
export type ConsentItem = z.infer<typeof ConsentItemSchema>;

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export const InfluencerBankAccountSchema = z.object({
  ownerType: InfluencerEntityTypeSchema,
  bankCode: z.string().regex(/^\d{4}$/, "4桁の銀行コードを入力してください"),
  bankName: z.string().min(1).max(40),
  branchName: z.string().min(1).max(50),
  accountType: JpAccountTypeSchema,
  accountNumber: z.string().regex(/^\d{6,8}$/, "口座番号は6~8桁の数字"),
  accountHolderKana: z.string().regex(KANA_RE, "カナで入力してください"),
});
export type InfluencerBankAccount = z.infer<typeof InfluencerBankAccountSchema>;

export const InfluencerSnsAccountInputSchema = z.object({
  snsType: SnsTypeSchema,
  handle: z
    .string()
    .transform(normalizeSnsHandle)
    .pipe(z.string().min(1, "ハンドルを入力してください").max(64)),
  followerCount: z.number().int().nonnegative(),
});
export type InfluencerSnsAccountInput = z.infer<
  typeof InfluencerSnsAccountInputSchema
>;

export const InfluencerBankAccountPublicSchema = InfluencerBankAccountSchema.omit({
  accountNumber: true,
}).extend({
  accountNumberMasked: z.string(),
});
export type InfluencerBankAccountPublic = z.infer<
  typeof InfluencerBankAccountPublicSchema
>;
