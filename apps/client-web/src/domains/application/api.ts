import {
  InfluencerApplicationListResponseSchema,
  InfluencerApplicationSchema,
  type ApplicationOption,
  type AttachmentUploadInput,
  type InfluencerApplication,
  type CampaignSubType,
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
  subTypes: CampaignSubType[],
  options: ApplicationOption[], // 서브타입 옵션 선택 (구 instagramPostType 일반화)
): Promise<InfluencerApplication> {
  const res = await api.post("/influencer/applications", {
    campaignId,
    subTypes,
    options,
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

/** SNS 게시물 URL 일괄 제출 — 참여한 모든 서브타입을 한 번에. */
export async function submitSubmission(
  id: string,
  posts: { subType: CampaignSubType; url: string }[],
): Promise<InfluencerApplication> {
  const res = await api.put(`/influencer/applications/${id}/submission`, {
    posts,
  });
  return InfluencerApplicationSchema.parse(res.data);
}

/** SNS 인사이트 일괄 제출 — 참여한 모든 서브타입을 한 번에. */
export async function submitInsights(
  id: string,
  insights: {
    subType: CampaignSubType;
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
  }[],
): Promise<InfluencerApplication> {
  const res = await api.put(`/influencer/applications/${id}/insights`, {
    insights,
  });
  return InfluencerApplicationSchema.parse(res.data);
}

export async function submitOrder(
  applicationId: string,
  orderNumber: string,
  receipts: AttachmentUploadInput[],
): Promise<InfluencerApplication> {
  const res = await api.post(
    `/influencer/applications/${applicationId}/order`,
    { orderNumber, receipts },
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function submitReview(
  applicationId: string,
  screenshots: AttachmentUploadInput[],
  reviewUrls: Partial<Record<"LIPS" | "ATCOSME", string>>,
): Promise<InfluencerApplication> {
  const res = await api.post(
    `/influencer/applications/${applicationId}/review`,
    { screenshots, reviewUrls },
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function submitSimpleReview(
  applicationId: string,
  reviews: { subType: CampaignSubType; url: string }[],
  screenshots: AttachmentUploadInput[],
): Promise<InfluencerApplication> {
  const res = await api.post(
    `/influencer/applications/${applicationId}/simple-review`,
    { reviews, screenshots },
  );
  return InfluencerApplicationSchema.parse(res.data);
}

export async function presignInsightUpload(input: {
  applicationId: string;
  subType: CampaignSubType;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
}): Promise<{ objectKey: string; uploadUrl: string; expiresInSec: number }> {
  const res = await api.post("/uploads/insight/presign", input);
  return res.data;
}
