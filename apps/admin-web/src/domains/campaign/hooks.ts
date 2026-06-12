import { useQuery } from "@tanstack/react-query";
import { getCampaign, listCampaigns } from "./api";

export function useCampaignList() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => getCampaign(id),
    enabled: Boolean(id),
  });
}
