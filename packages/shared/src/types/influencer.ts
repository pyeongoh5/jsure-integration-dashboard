import { z } from "zod";
import { normalizeSnsHandle } from "../utils/snsHandle.js";
import { KR_PROVINCES } from "../data/krBanks.js";

/**
 * 캠페인 서브타입.
 * - SNS 캠페인: INSTAGRAM / TIKTOK / X / YOUTUBE
 * - 가구매 캠페인: QOO10
 * - 단순 리뷰 캠페인: LIPS / ATCOSME
 * 인플루언서의 SNS 계정 프로필에는 SNS 계열만 사용된다(`SnsAccountSubType` 참고).
 */
export const CampaignSubTypeSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
  "QOO10",
  "LIPS",
  "ATCOSME",
]);
export type CampaignSubType = z.infer<typeof CampaignSubTypeSchema>;

/** 인플루언서 SNS 계정에 사용 가능한 서브타입(가구매용 서브타입은 제외). */
export const SnsAccountSubTypeSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
]);
export type SnsAccountSubType = z.infer<typeof SnsAccountSubTypeSchema>;

/**
 * SNS 활성 플래그. 초기 운영은 Instagram·X만 허용한다.
 * TikTok·YouTube를 재오픈하려면 이 객체의 값만 `true`로 바꾸고 빌드한다.
 * `Record<SnsAccountSubType, boolean>`로 두어, 새 서브타입 추가 시 키 누락을 컴파일 타임에 잡는다.
 */
export const SNS_ENABLED: Record<SnsAccountSubType, boolean> = {
  INSTAGRAM: true,
  TIKTOK: true,
  X: true,
  YOUTUBE: false,
};

export const isEnabledSnsType = (subType: SnsAccountSubType): boolean =>
  SNS_ENABLED[subType];

export const ENABLED_SNS_TYPES: readonly SnsAccountSubType[] = (
  Object.keys(SNS_ENABLED) as SnsAccountSubType[]
).filter(isEnabledSnsType);

export const EnabledSnsTypeSchema = z.enum(
  ENABLED_SNS_TYPES as unknown as [SnsAccountSubType, ...SnsAccountSubType[]],
);
export type EnabledSnsType = z.infer<typeof EnabledSnsTypeSchema>;

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

/** 주소·계좌 형식의 국가. 활성 값은 항상 하나이고 주소와 계좌는 서로 독립이다. */
export const AddressCountrySchema = z.enum(["JP", "KR"]);
export type AddressCountry = z.infer<typeof AddressCountrySchema>;

export const JpBankAccountSchema = z.object({
  country: z.literal("JP"),
  bankCode: z.string().regex(/^\d{4}$/, "4桁の銀行コードを入力してください"),
  bankName: z.string().min(1).max(40),
  branchName: z.string().min(1).max(50),
  branchCode: z.string().max(10),
  accountNumber: z.string().regex(/^\d{7}$/, "口座番号は7桁の数字"),
  accountHolder: z.string().regex(KANA_RE, "カナで入力してください"),
  /** 適格請求書登録番号 (인보이스 등록번호). T + 13자리 숫자, 선택 입력. */
  invoiceRegistrationNumber: z
    .string()
    .regex(/^T\d{13}$/, "T + 13桁の数字で入力してください")
    .nullable()
    .optional(),
});

/**
 * 한국 계좌. 지점은 국내이체에 무관하므로 받지 않고, 인보이스 등록번호도 쓰지 않는다.
 * 서버가 저장할 때 일본 전용 컬럼(branchName/branchCode)을 빈 문자열로 채운다.
 */
export const KrBankAccountSchema = z.object({
  country: z.literal("KR"),
  bankCode: z.string().regex(/^\d{3}$/, "은행을 선택해 주세요"),
  bankName: z.string().min(1).max(40),
  accountNumber: z
    .string()
    .regex(/^[\d-]{6,20}$/, "계좌번호는 숫자와 하이픈만 입력해 주세요"),
  accountHolder: z.string().min(1, "예금주명을 입력해 주세요").max(40),
});

export const InfluencerBankAccountSchema = z.discriminatedUnion("country", [
  JpBankAccountSchema,
  KrBankAccountSchema,
]);

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

export const KrProvinceSchema = z.enum(KR_PROVINCES);
export type KrProvince = z.infer<typeof KrProvinceSchema>;

export const JpAddressSchema = z.object({
  country: z.literal("JP"),
  postalCode: z
    .string()
    .regex(/^\d{3}-?\d{4}$/, "郵便番号は7桁の数字")
    .transform((v) => (v.length === 7 ? `${v.slice(0, 3)}-${v.slice(3)}` : v)),
  prefecture: JpPrefectureSchema,
  city: z.string().min(1, "市区町村は必須").max(100),
  addressLine1: z.string().min(1, "番地は必須").max(100),
  addressLine2: z.string().max(100).optional().default(""),
});

/** 한국 주소. 컬럼은 일본과 공유하고 의미만 시/도·시군구·도로명·상세로 바뀐다. */
export const KrAddressSchema = z.object({
  country: z.literal("KR"),
  postalCode: z.string().regex(/^\d{5}$/, "우편번호는 5자리 숫자"),
  prefecture: KrProvinceSchema,
  city: z.string().min(1, "시·군·구는 필수").max(100),
  addressLine1: z.string().min(1, "도로명 주소는 필수").max(100),
  addressLine2: z.string().max(100).optional().default(""),
});

export const InfluencerAddressSchema = z.discriminatedUnion("country", [
  JpAddressSchema,
  KrAddressSchema,
]);
export type InfluencerAddress = z.infer<typeof InfluencerAddressSchema>;
export type InfluencerBankAccount = z.infer<typeof InfluencerBankAccountSchema>;

export const InfluencerSnsAccountInputSchema = z.object({
  snsType: EnabledSnsTypeSchema,
  handle: z
    .string()
    .transform(normalizeSnsHandle)
    .pipe(z.string().min(1, "ハンドルを入力してください").max(64)),
  followerCount: z.number().int().nonnegative(),
});
export type InfluencerSnsAccountInput = z.infer<
  typeof InfluencerSnsAccountInputSchema
>;

/** 응답·표시용. 비활성 SNS를 포함한 기존 데이터도 안전하게 파싱할 수 있도록 SNS 계열 전체를 허용한다. */
export const InfluencerSnsAccountSchema = InfluencerSnsAccountInputSchema.extend({
  snsType: SnsAccountSubTypeSchema,
});
export type InfluencerSnsAccount = z.infer<typeof InfluencerSnsAccountSchema>;

/** 응답용 계좌번호 필드. 목록에는 마스킹만, 수정 폼 프리필에는 전체 번호를 쓴다. */
const publicAccountNumberFields = {
  accountNumberMasked: z.string(),
  /** 마이페이지 수정 폼 프리필용 전체 계좌번호. optional 은 구 API 응답 호환용. */
  accountNumber: z.string().optional(),
};

export const InfluencerBankAccountPublicSchema = z.discriminatedUnion("country", [
  JpBankAccountSchema.omit({ accountNumber: true }).extend(
    publicAccountNumberFields,
  ),
  KrBankAccountSchema.omit({ accountNumber: true }).extend(
    publicAccountNumberFields,
  ),
]);
export type InfluencerBankAccountPublic = z.infer<
  typeof InfluencerBankAccountPublicSchema
>;
