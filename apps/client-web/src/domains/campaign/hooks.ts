import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
  CampaignSubType,
} from "@jsure/shared";
import { listCampaigns, getCampaign } from "./api";

export function useCampaignList(
  sns: CampaignSubType,
): UseQueryResult<InfluencerCampaignCard[]> {
  return useQuery({
    queryKey: ["influencer-campaigns", sns],
    queryFn: () => listCampaigns(sns),
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
