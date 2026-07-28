import {
  CampaignListResponseSchema,
  CampaignResponseSchema,
  type CampaignDraftRequest,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { api } from "@/lib/api";

/**
 * 캠페인 목록. 기본은 발행된 캠페인만 — 임시저장은 캠페인 관리 화면에서만
 * includeDrafts 로 받아온다.
 */
export async function listCampaigns(options?: {
  includeDrafts?: boolean;
}): Promise<CampaignResponse[]> {
  const res = await api.get("/campaigns", {
    params: options?.includeDrafts ? { includeDrafts: 1 } : undefined,
  });
  return CampaignListResponseSchema.parse(res.data).campaigns;
}

export async function getCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.get(`/campaigns/${encodeURIComponent(id)}`);
  return CampaignResponseSchema.parse(res.data);
}

export async function createCampaign(
  input: CreateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.post("/campaigns", input);
  return CampaignResponseSchema.parse(res.data);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.patch(
    `/campaigns/${encodeURIComponent(id)}`,
    input,
  );
  return CampaignResponseSchema.parse(res.data);
}

export async function createCampaignDraft(
  input: CampaignDraftRequest,
): Promise<CampaignResponse> {
  const res = await api.post("/campaign-drafts", input);
  return CampaignResponseSchema.parse(res.data);
}

export async function updateCampaignDraft(
  id: string,
  input: CampaignDraftRequest,
): Promise<CampaignResponse> {
  const res = await api.patch(
    `/campaign-drafts/${encodeURIComponent(id)}`,
    input,
  );
  return CampaignResponseSchema.parse(res.data);
}

/** 임시저장 발행 — 캠페인 생성과 동일한 엄격 검증을 서버에서 다시 수행한다. */
export async function publishCampaignDraft(
  id: string,
  input: CreateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.post(
    `/campaign-drafts/${encodeURIComponent(id)}/publish`,
    input,
  );
  return CampaignResponseSchema.parse(res.data);
}

export async function deleteCampaignDraft(id: string): Promise<void> {
  await api.delete(`/campaign-drafts/${encodeURIComponent(id)}`);
}

export async function closeCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/close`);
  return CampaignResponseSchema.parse(res.data);
}
