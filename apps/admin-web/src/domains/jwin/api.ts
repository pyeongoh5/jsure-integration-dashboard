import { jwinApi } from "../../lib/api";
import {
  AdminCampaignDetailSchema,
  AdminPrizeListSchema,
  AdminPostTemplateListSchema,
  AdminWinnerListSchema,
  AdminShippingSchema,
  AdminPrizeSchema,
  AdminWinnerSchema,
  type AdminCampaignDetail,
  type AdminPrizeList,
  type AdminPostTemplateList,
  type AdminWinnerList,
  type AdminShipping,
  type AdminPrize,
  type AdminPrizePatch,
  type AdminWinner,
  type AdminFulfillmentPatch,
} from "./types";

export async function fetchCampaign(campaignId: string): Promise<AdminCampaignDetail> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}`);
  return AdminCampaignDetailSchema.parse(response.data);
}

export async function fetchPrizes(campaignId: string): Promise<AdminPrizeList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/prizes`);
  return AdminPrizeListSchema.parse(response.data);
}

export async function fetchPostTemplates(campaignId: string): Promise<AdminPostTemplateList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/post-templates`);
  return AdminPostTemplateListSchema.parse(response.data);
}

export async function fetchWinners(campaignId: string): Promise<AdminWinnerList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/winners`);
  return AdminWinnerListSchema.parse(response.data);
}

export async function fetchShipping(winnerId: string): Promise<AdminShipping> {
  const response = await jwinApi.get(`/admin/winners/${winnerId}/shipping`);
  return AdminShippingSchema.parse(response.data);
}

export async function updateFulfillment(
  winnerId: string,
  body: AdminFulfillmentPatch,
): Promise<AdminWinner> {
  const response = await jwinApi.patch(`/admin/winners/${winnerId}/fulfillment`, body);
  return AdminWinnerSchema.parse(response.data);
}

export async function updatePrize(prizeId: string, body: AdminPrizePatch): Promise<AdminPrize> {
  const response = await jwinApi.patch(`/admin/prizes/${prizeId}`, body);
  return AdminPrizeSchema.parse(response.data);
}

export async function deletePostTemplate(templateId: string): Promise<void> {
  await jwinApi.delete(`/admin/post-templates/${templateId}`);
}
