import { useEffect, useState } from "react";
import { listCampaigns } from "@/lib/campaigns";
import type { CampaignOption } from "./types";

export type UseCampaignOptionsResult = {
  campaignOptions: CampaignOption[];
  campaignTitleById: Map<string, string>;
  loaded: boolean;
};

export function useCampaignOptions(): UseCampaignOptionsResult {
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignTitleById, setCampaignTitleById] = useState<
    Map<string, string>
  >(() => new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then((rows) => {
        if (cancelled) return;
        setCampaignTitleById(
          new Map(rows.map((campaign) => [campaign.id, campaign.title])),
        );
        setCampaignOptions(
          rows
            .filter((campaign) => campaign.closedAt === null)
            .map((campaign) => ({ id: campaign.id, title: campaign.title })),
        );
      })
      .catch(() => {
        // chip falls back to raw id
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { campaignOptions, campaignTitleById, loaded };
}
