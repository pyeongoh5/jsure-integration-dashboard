import {
  InfluencerApplicationListResponseSchema,
  InfluencerApplicationSchema,
  type InfluencerApplication,
  type InstagramPostType,
  type SnsType,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listApplications(): Promise<InfluencerApplication[]> {
  const res = await api.get("/influencer/applications");
  return InfluencerApplicationListResponseSchema.parse(res.data).applications;
}

export async function getApplication(
  id: string,
): Promise<InfluencerApplication> {
  const res = await api.get(`/influencer/applications/${id}`);
  return InfluencerApplicationSchema.parse(res.data);
}

export async function createApplication(
  campaignId: string,
  snsTypes: SnsType[],
  instagramPostType: InstagramPostType | null,
): Promise<InfluencerApplication> {
  const res = await api.post("/influencer/applications", {
    campaignId,
    snsTypes,
    instagramPostType: instagramPostType ?? undefined,
  });
  return InfluencerApplicationSchema.parse(res.data);
}

export async function cancelApplication(
  id: string,
): Promise<InfluencerApplication> {
  const res = await api.post(`/influencer/applications/${id}/cancel`);
  return InfluencerApplicationSchema.parse(res.data);
}

export async function confirmReceipt(
  id: string,
): Promise<InfluencerApplication> {
  const res = await api.post(
    `/influencer/applications/${id}/confirm-receipt`,
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function submitPost(
  id: string,
  snsType: SnsType,
  url: string,
): Promise<InfluencerApplication> {
  const res = await api.put(
    `/influencer/applications/${id}/posts/${snsType}`,
    { url },
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function submitInsight(
  id: string,
  snsType: SnsType,
  input: {
    likes: number;
    comments: number;
    shares: number;
    reposts: number;
    saves: number;
    views: number;
    reach: number;
    attachments?: {
      objectKey: string;
      contentType: "image/png" | "image/jpeg" | "image/webp";
      sizeBytes: number;
    }[];
  },
): Promise<InfluencerApplication> {
  const res = await api.put(
    `/influencer/applications/${id}/posts/${snsType}/insight`,
    input,
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function presignInsightUpload(input: {
  applicationId: string;
  snsType: SnsType;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
}): Promise<{ objectKey: string; uploadUrl: string; expiresInSec: number }> {
  const res = await api.post("/uploads/insight/presign", input);
  return res.data;
}
