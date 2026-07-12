import {
  InfluencerCampaignDetailSchema,
  InfluencerCampaignListResponseSchema,
  type InfluencerCampaignCard,
  type InfluencerCampaignDetail,
  type CampaignCategory, // new
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listCampaigns(
  category?: CampaignCategory, // new
): Promise<InfluencerCampaignCard[]> {
  const res = await api.get("/influencer/campaigns", {
    params: category ? { category } : undefined, // new
  });
  return InfluencerCampaignListResponseSchema.parse(res.data).campaigns;
}

export async function getCampaign(id: string): Promise<InfluencerCampaignDetail> {
  const res = await api.get(`/influencer/campaigns/${id}`);
  return InfluencerCampaignDetailSchema.parse(res.data);
}
