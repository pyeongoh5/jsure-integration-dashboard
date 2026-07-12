import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
  CampaignCategory, // new
} from "@jsure/shared";
import { listCampaigns, getCampaign } from "./api";

export function useCampaignList(
  category: CampaignCategory, // new
): UseQueryResult<InfluencerCampaignCard[]> {
  return useQuery({
    queryKey: ["influencer-campaigns", category], // new
    queryFn: () => listCampaigns(category), // new
  });
}

export function useCampaign(
  id: string,
): UseQueryResult<InfluencerCampaignDetail> {
  return useQuery({
    queryKey: ["influencer-campaign", id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
  });
}
