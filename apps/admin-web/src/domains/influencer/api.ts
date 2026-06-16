import {
  AdminInfluencerListResponseSchema,
  InfluencerMemoEntrySchema,
  InfluencerNotesResponseSchema,
  type AdminInfluencer,
  type InfluencerMemoEntry,
  type InfluencerNotesResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listInfluencers(): Promise<AdminInfluencer[]> {
  const res = await api.get("/influencers");
  return AdminInfluencerListResponseSchema.parse(res.data).influencers;
}

export async function fetchInfluencerNotes(
  influencerId: string,
): Promise<InfluencerNotesResponse> {
  const res = await api.get(
    `/influencers/${encodeURIComponent(influencerId)}/notes`,
  );
  return InfluencerNotesResponseSchema.parse(res.data);
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
