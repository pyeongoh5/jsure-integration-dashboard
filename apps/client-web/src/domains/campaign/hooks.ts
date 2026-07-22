import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
  CampaignCategory,
} from "@jsure/shared";
import { listCampaigns, getCampaign } from "./api";

export function useCampaignList(
  category: CampaignCategory,
): UseQueryResult<InfluencerCampaignCard[]> {
  return useQuery({
    queryKey: ["influencer-campaigns", category],
    queryFn: () => listCampaigns(category),
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
