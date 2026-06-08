import { z } from "zod";
import { normalizeSnsHandle } from "../utils/snsHandle.js";

export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

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
  bankCode: z.string().regex(/^\d{4}$/, "4桁の銀行コードを入力してください"),
  bankName: z.string().min(1).max(40),
  branchName: z.string().min(1).max(50),
  branchCode: z.string().max(10),
  accountType: JpAccountTypeSchema,
  accountNumber: z.string().regex(/^\d{6,8}$/, "口座番号は6~8桁の数字"),
  accountHolderKana: z.string().regex(KANA_RE, "カナで入力してください"),
});

export const JP_PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;
export const JpPrefectureSchema = z.enum(JP_PREFECTURES);
export type JpPrefecture = z.infer<typeof JpPrefectureSchema>;

export const InfluencerAddressSchema = z.object({
  postalCode: z
    .string()
    .regex(/^\d{3}-?\d{4}$/, "郵便番号は7桁の数字")
    .transform((v) => (v.length === 7 ? `${v.slice(0, 3)}-${v.slice(3)}` : v)),
  prefecture: JpPrefectureSchema,
  city: z.string().min(1, "市区町村は必須").max(100),
  addressLine1: z.string().min(1, "番地は必須").max(100),
  addressLine2: z.string().max(100).optional().default(""),
});
export type InfluencerAddress = z.infer<typeof InfluencerAddressSchema>;
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
