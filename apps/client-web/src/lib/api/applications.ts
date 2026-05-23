import {
  InfluencerApplicationListResponseSchema,
  InfluencerApplicationSchema,
  type InfluencerApplication,
  type SnsType,
} from "@jsure/shared";
import { api } from "../api";

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
): Promise<InfluencerApplication> {
  const res = await api.post("/influencer/applications", { campaignId });
  return InfluencerApplicationSchema.parse(res.data);
}

export async function cancelApplication(
  id: string,
): Promise<InfluencerApplication> {
  const res = await api.post(`/influencer/applications/${id}/cancel`);
  return InfluencerApplicationSchema.parse(res.data);
}

export async function confirmDelivery(
  id: string,
): Promise<InfluencerApplication> {
  const res = await api.post(
    `/influencer/applications/${id}/confirm-delivery`,
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
  input: { saves: number; reach: number; profileViews: number },
): Promise<InfluencerApplication> {
  const res = await api.put(
    `/influencer/applications/${id}/posts/${snsType}/insight`,
    input,
  );
  return InfluencerApplicationSchema.parse(res.data);
}
