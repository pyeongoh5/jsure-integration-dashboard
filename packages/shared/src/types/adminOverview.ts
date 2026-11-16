import { z } from "zod";

export const AdminOverviewResponseSchema = z.object({
  recruitingCampaignCount: z.number().int().nonnegative(),
  pendingApplicationCount: z.number().int().nonnegative(),
  pendingPostReviewCount: z.number().int().nonnegative(),
  pendingSettlementAmountJpy: z.number().int().nonnegative(),
  pendingSettlementCount: z.number().int().nonnegative(),
  /** 로그인한 어드민이 담당자로 지정된 모집중 캠페인 수. default 는 이 필드를 아직
   * 내려주지 않는 구 API 와의 배포 갭 대비. */
  myRecruitingCampaignCount: z.number().int().nonnegative().default(0),
});

export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
