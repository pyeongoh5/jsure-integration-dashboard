import {
  InfluencerCampaignDetailSchema,
  InfluencerCampaignListResponseSchema,
  type InfluencerCampaignCard,
  type InfluencerCampaignDetail,
  type SnsType,
} from "@jsure/shared";
import { api } from "../api";

export async function listCampaigns(sns?: SnsType): Promise<InfluencerCampaignCard[]> {
  const res = await api.get("/influencer/campaigns", {
    params: sns ? { sns } : undefined,
  });
  return InfluencerCampaignListResponseSchema.parse(res.data).campaigns;
}

export async function getCampaign(id: string): Promise<InfluencerCampaignDetail> {
  const res = await api.get(`/influencer/campaigns/${id}`);
  return InfluencerCampaignDetailSchema.parse(res.data);
}
