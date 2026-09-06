import { jwinApi } from "@/lib/api";
import {
  AdminCampaignListSchema,
  AdminCampaignDetailSchema,
  AdminCampaignDeleteImpactSchema,
  AdminBrandCampaignDeleteImpactSchema,
  AdminBrandCampaignDetailSchema,
  AdminBrandCampaignListSchema,
  AdminBrandAccountListSchema,
  AdminBrandAccountSchema,
  AdminPrizeListSchema,
  AdminPrizeCodeListSchema,
  AdminPostTemplateListSchema,
  AdminWinnerListSchema,
  AdminWinnerExportSchema,
  AdminCampaignStatsSchema,
  AdminShippingSchema,
  AdminPrizeSchema,
  AdminWinnerSchema,
  type AdminCampaignList,
  type AdminCampaignDetail,
  type AdminCampaignDeleteImpact,
  type AdminBrandAccountCreate,
  type AdminBrandAccountPatch,
  type AdminBrandCampaignCreate,
  type AdminBrandCampaignDeleteImpact,
  type AdminBrandCampaignDetail,
  type AdminBrandCampaignList,
  type AdminBrandCampaignPatch,
  type AdminCampaignCreate,
  type AdminCampaignPatch,
  type AdminBrandAccountList,
  type AdminBrandAccount,
  type AdminPrizeList,
  type AdminPrizeCode,
  type AdminPostTemplateList,
  type AdminWinnerList,
  type AdminWinnerFilter,
  type AdminWinnerExport,
  type AdminCampaignStats,
  type AdminShipping,
  type AdminPrize,
  type AdminPrizePatch,
  type AdminPrizeCreate,
  type AdminPostTemplateCreate,
  type AdminPostTemplatePatch,
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

/** 시즌에 참여 중인 브랜드 목록. */
export async function fetchBrandCampaigns(campaignId: string): Promise<AdminBrandCampaignList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/brand-campaigns`);
  return AdminBrandCampaignListSchema.parse(response.data);
}

export async function fetchBrandCampaign(
  brandCampaignId: string,
): Promise<AdminBrandCampaignDetail> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}`);
  return AdminBrandCampaignDetailSchema.parse(response.data);
}

/** 브랜드를 시즌에 참여시킨다. */
export async function createBrandCampaign(
  body: AdminBrandCampaignCreate,
): Promise<AdminBrandCampaignDetail> {
  const response = await jwinApi.post(`/admin/brand-campaigns`, body);
  return AdminBrandCampaignDetailSchema.parse(response.data);
}

export async function updateBrandCampaign(
  brandCampaignId: string,
  body: AdminBrandCampaignPatch,
): Promise<AdminBrandCampaignDetail> {
  const response = await jwinApi.patch(`/admin/brand-campaigns/${brandCampaignId}`, body);
  return AdminBrandCampaignDetailSchema.parse(response.data);
}

export async function fetchPrizes(brandCampaignId: string): Promise<AdminPrizeList> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}/prizes`);
  return AdminPrizeListSchema.parse(response.data);
}

export async function fetchPostTemplates(brandCampaignId: string): Promise<AdminPostTemplateList> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}/post-templates`);
  return AdminPostTemplateListSchema.parse(response.data);
}

/** 필터를 쿼리스트링으로 옮긴다. 빈 값은 보내지 않아 서버가 "전체"로 읽게 한다. */
function winnerFilterParams(filter: AdminWinnerFilter): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filter).filter(([, value]) => typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
}

/** 당첨자 목록 한 페이지. 필터는 서버가 걸고 커서로 이어 받는다. */
export async function fetchWinners(
  brandCampaignId: string,
  filter: AdminWinnerFilter,
  cursor?: string,
): Promise<AdminWinnerList> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}/winners`, {
    params: { ...winnerFilterParams(filter), ...(cursor ? { cursor } : {}) },
  });
  return AdminWinnerListSchema.parse(response.data);
}

/**
 * CSV용 전체 행. 현재 로드된 페이지가 아니라 **필터에 걸린 전체**를 받는다.
 * 배송지 평문이 포함되므로 서버가 열람과 동일하게 감사 로그를 남긴다.
 */
export async function fetchWinnersForExport(
  brandCampaignId: string,
  filter: AdminWinnerFilter,
): Promise<AdminWinnerExport> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}/winners/export`, {
    params: winnerFilterParams(filter),
  });
  return AdminWinnerExportSchema.parse(response.data);
}

export async function fetchCampaignStats(brandCampaignId: string): Promise<AdminCampaignStats> {
  const response = await jwinApi.get(`/admin/brand-campaigns/${brandCampaignId}/stats`);
  return AdminCampaignStatsSchema.parse(response.data);
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

/** 시즌 삭제 시 함께 사라지는 데이터 건수 — 참여 브랜드들의 합산. */
export async function fetchCampaignDeleteImpact(
  campaignId: string,
): Promise<AdminCampaignDeleteImpact> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/delete-impact`);
  return AdminCampaignDeleteImpactSchema.parse(response.data);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await jwinApi.delete(`/admin/campaigns/${campaignId}`);
}

/** 참여 삭제 시 함께 사라지는 데이터 건수. */
export async function fetchBrandCampaignDeleteImpact(
  brandCampaignId: string,
): Promise<AdminBrandCampaignDeleteImpact> {
  const response = await jwinApi.get(
    `/admin/brand-campaigns/${brandCampaignId}/delete-impact`,
  );
  return AdminBrandCampaignDeleteImpactSchema.parse(response.data);
}

export async function deleteBrandCampaign(brandCampaignId: string): Promise<void> {
  await jwinApi.delete(`/admin/brand-campaigns/${brandCampaignId}`);
}

/** 브랜드 표시명·slug·로고 수정. */
export async function updateBrandAccount(
  brandAccountId: string,
  body: AdminBrandAccountPatch,
): Promise<AdminBrandAccount> {
  const response = await jwinApi.patch(`/admin/brand-accounts/${brandAccountId}`, body);
  return AdminBrandAccountSchema.parse(response.data);
}

/** 포스트 정정. 응답이 Prisma 모델이라 파싱하지 않는다 — 호출부가 목록을 다시 불러온다. */
export async function updatePostTemplate(
  templateId: string,
  body: AdminPostTemplatePatch,
): Promise<void> {
  await jwinApi.patch(`/admin/post-templates/${templateId}`, body);
}

export async function deletePostTemplate(templateId: string): Promise<void> {
  await jwinApi.delete(`/admin/post-templates/${templateId}`);
}

export async function fetchBrandAccounts(): Promise<AdminBrandAccountList> {
  const response = await jwinApi.get(`/admin/brand-accounts`);
  return AdminBrandAccountListSchema.parse(response.data);
}

export async function createBrandAccount(
  body: AdminBrandAccountCreate,
): Promise<AdminBrandAccount> {
  const response = await jwinApi.post(`/admin/brand-accounts`, body);
  return AdminBrandAccountSchema.parse(response.data);
}

/**
 * 경품 등록 (코드 동시 등록 — F-1.3, F-7.3).
 * 서버가 Prisma 모델을 그대로 돌려주므로(AdminPrizeSchema 모양이 아님) 응답을 파싱하지 않는다.
 * 호출부는 성공 후 `fetchPrizes` 로 목록을 다시 불러온다.
 */
export async function createPrize(body: AdminPrizeCreate): Promise<void> {
  await jwinApi.post(`/admin/prizes`, body);
}

/** 등록된 기프트코드 목록 — 서버가 원문을 복호화해 내려준다(열람은 감사 로그에 남는다). */
export async function fetchPrizeCodes(prizeId: string): Promise<AdminPrizeCode[]> {
  const response = await jwinApi.get(`/admin/prizes/${prizeId}/codes`);
  return AdminPrizeCodeListSchema.parse(response.data).codes;
}

/** CODE 재고 보충. 본문은 붙여넣기 원문 그대로(jwin-api 가 text/plain 파서를 등록해 둔다). */
export async function appendPrizeCodes(prizeId: string, codesText: string): Promise<void> {
  await jwinApi.post(`/admin/prizes/${prizeId}/codes`, codesText, {
    headers: { "Content-Type": "text/plain" },
  });
}

/** 소재 등록. 서버 응답이 Prisma 모델이라 파싱하지 않는다 — 호출부가 목록을 다시 불러온다. */
export async function createPostTemplate(body: AdminPostTemplateCreate): Promise<void> {
  await jwinApi.post(`/admin/post-templates`, body);
}
