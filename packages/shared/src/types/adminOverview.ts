import { z } from "zod";

export const AdminOverviewResponseSchema = z.object({
  recruitingCampaignCount: z.number().int().nonnegative(),
  pendingApplicationCount: z.number().int().nonnegative(),
  pendingPostReviewCount: z.number().int().nonnegative(),
  pendingSettlementAmountJpy: z.number().int().nonnegative(),
  pendingSettlementCount: z.number().int().nonnegative(),
});

export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
