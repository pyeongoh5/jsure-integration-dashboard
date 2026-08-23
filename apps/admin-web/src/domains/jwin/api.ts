import { jwinApi } from "@/lib/api";
import {
  AdminCampaignListSchema,
  AdminCampaignDetailSchema,
  AdminBrandAccountListSchema,
  AdminBrandAccountSchema,
  AdminPrizeListSchema,
  AdminPostTemplateListSchema,
  AdminWinnerListSchema,
  AdminShippingSchema,
  AdminPrizeSchema,
  AdminWinnerSchema,
  type AdminCampaignList,
  type AdminCampaignDetail,
  type AdminCampaignCreate,
  type AdminCampaignPatch,
  type AdminBrandAccountList,
  type AdminBrandAccount,
  type AdminPrizeList,
  type AdminPostTemplateList,
  type AdminWinnerList,
  type AdminShipping,
  type AdminPrize,
  type AdminPrizePatch,
  type AdminWinner,
  type AdminFulfillmentPatch,
} from "./types";

export async function fetchCampaigns(): Promise<AdminCampaignList> {
  const response = await jwinApi.get(`/admin/campaigns`);
  return AdminCampaignListSchema.parse(response.data);
}

export async function fetchCampaign(campaignId: string): Promise<AdminCampaignDetail> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}`);
  return AdminCampaignDetailSchema.parse(response.data);
}

export async function createCampaign(body: AdminCampaignCreate): Promise<AdminCampaignDetail> {
  const response = await jwinApi.post(`/admin/campaigns`, body);
  return AdminCampaignDetailSchema.parse(response.data);
}

export async function updateCampaign(
  campaignId: string,
  body: AdminCampaignPatch,
): Promise<AdminCampaignDetail> {
  const response = await jwinApi.patch(`/admin/campaigns/${campaignId}`, body);
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

export async function fetchBrandAccounts(): Promise<AdminBrandAccountList> {
  const response = await jwinApi.get(`/admin/brand-accounts`);
  return AdminBrandAccountListSchema.parse(response.data);
}

export async function createBrandAccount(label: string): Promise<AdminBrandAccount> {
  const response = await jwinApi.post(`/admin/brand-accounts`, { label });
  return AdminBrandAccountSchema.parse(response.data);
}
