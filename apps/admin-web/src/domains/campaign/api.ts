import { z } from "zod";
import {
  CampaignResponseSchema,
  type CampaignDraftRequest,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 행 단위 검증을 위해 배열 요소는 여기서 파싱하지 않는다. */
const CampaignListEnvelopeSchema = z.object({
  campaigns: z.array(z.unknown()),
});

/** 스키마에 어긋난 행을 로그에서 특정하기 위한 최소 식별 정보. */
const CampaignRowIdentitySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
});

/**
 * 캠페인 목록. 기본은 발행된 캠페인만 — 임시저장은 캠페인 관리 화면에서만
 * includeDrafts 로 받아온다.
 *
 * 검증은 행 단위다. 배열 통째로 parse 하면 캠페인 한 건이 스키마에 어긋나는
 * 순간 목록이 빈 배열이 되어 앱 전체의 캠페인 선택 UI 가 동시에 죽는다.
 * 어긋난 행은 콘솔에 id 와 위반 필드를 남기고 건너뛴다.
 */
export async function listCampaigns(options?: {
  includeDrafts?: boolean;
}): Promise<CampaignResponse[]> {
  const res = await api.get("/campaigns", {
    params: options?.includeDrafts ? { includeDrafts: 1 } : undefined,
  });
  const rows = CampaignListEnvelopeSchema.parse(res.data).campaigns;
  const campaigns: CampaignResponse[] = [];
  for (const row of rows) {
    const parsed = CampaignResponseSchema.safeParse(row);
    if (parsed.success) {
      campaigns.push(parsed.data);
      continue;
    }
    const identity = CampaignRowIdentitySchema.safeParse(row);
    console.error("캠페인 응답이 스키마에 어긋나 목록에서 제외했습니다", {
      campaign: identity.success ? identity.data : null,
      issues: parsed.error.issues,
    });
  }
  return campaigns;
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

/** 임시저장은 물리 삭제, 발행된 캠페인은 종료와 함께 논리 삭제된다. */
export async function deleteCampaign(id: string): Promise<void> {
  await api.delete(`/campaigns/${encodeURIComponent(id)}`);
}

/** 끌어올리기 — 인플루언서 목록에서 같은 상태 그룹 내 최상단으로 올린다. */
export async function bumpCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/bump`);
  return CampaignResponseSchema.parse(res.data);
}

export async function closeCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/close`);
  return CampaignResponseSchema.parse(res.data);
}

/** 비공개 전환 — 모집이 종결된 캠페인만 서버에서 허용한다. */
export async function hideCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/hide`);
  return CampaignResponseSchema.parse(res.data);
}

export async function unhideCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/unhide`);
  return CampaignResponseSchema.parse(res.data);
}
