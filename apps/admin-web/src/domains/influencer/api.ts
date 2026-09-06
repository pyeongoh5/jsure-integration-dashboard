import {
  AdminInfluencerExportResponseSchema,
  AdminInfluencerPageResponseSchema,
  InfluencerActivityResponseSchema,
  InfluencerMemoEntrySchema,
  InfluencerNotesResponseSchema,
  influencerFilterToParams,
  type AdminInfluencerExportResponse,
  type AdminInfluencerPageResponse,
  type InfluencerActivityGroup,
  type InfluencerFilter,
  type InfluencerMemoEntry,
  type InfluencerNotesResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 인플루언서 관리 목록 한 페이지 — 필터는 서버가 적용하고 total 도 서버가 센다. */
export async function listInfluencersPage(
  filter: InfluencerFilter,
  cursor: string | null,
  limit: number,
): Promise<AdminInfluencerPageResponse> {
  const search = new URLSearchParams(influencerFilterToParams(filter));
  search.set("limit", String(limit));
  if (cursor) search.set("cursor", cursor);
  const res = await api.get(`/influencers?${search}`);
  return AdminInfluencerPageResponseSchema.parse(res.data);
}

/** 필터에 걸린 인플루언서 전체 — CSV 내보내기와 일괄 발송 후보가 함께 쓴다. */
export async function exportInfluencers(
  filter: InfluencerFilter,
): Promise<AdminInfluencerExportResponse> {
  const search = new URLSearchParams(influencerFilterToParams(filter));
  const res = await api.get(`/influencers/export?${search}`);
  return AdminInfluencerExportResponseSchema.parse(res.data);
}

export async function fetchInfluencerNotes(
  influencerId: string,
): Promise<InfluencerNotesResponse> {
  const res = await api.get(
    `/influencers/${encodeURIComponent(influencerId)}/notes`,
  );
  return InfluencerNotesResponseSchema.parse(res.data);
}

export async function fetchInfluencerActivity(
  influencerId: string,
): Promise<InfluencerActivityGroup[]> {
  const res = await api.get(
    `/influencers/${encodeURIComponent(influencerId)}/activity`,
  );
  return InfluencerActivityResponseSchema.parse(res.data).groups;
}

export async function createInfluencerMemo(
  influencerId: string,
  comment: string,
  campaignId: string | null = null,
): Promise<InfluencerMemoEntry> {
  const res = await api.post(
    `/influencers/${encodeURIComponent(influencerId)}/memos`,
    { comment, campaignId },
  );
  return InfluencerMemoEntrySchema.parse(res.data);
}

export async function flagInfluencer(
  influencerId: string,
): Promise<{ flaggedAt: string }> {
  const res = await api.post(
    `/influencers/${encodeURIComponent(influencerId)}/flag`,
  );
  return res.data as { flaggedAt: string };
}

export async function unflagInfluencer(influencerId: string): Promise<void> {
  await api.delete(`/influencers/${encodeURIComponent(influencerId)}/flag`);
}
