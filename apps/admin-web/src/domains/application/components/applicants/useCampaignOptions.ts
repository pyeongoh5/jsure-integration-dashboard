import { useEffect, useState } from "react";
import { listCampaigns } from "@/domains/campaign";
import type { CampaignOption } from "./types";

export type UseCampaignOptionsResult = {
  campaignOptions: CampaignOption[];
  campaignTitleById: Map<string, string>;
  loaded: boolean;
};

/**
 * 모집 종료 판정. 서버 deriveCampaignStatus 의 done 조건(수동 종료 또는 모집 마감일 경과)과
 * 같은 기준이라 캠페인 관리 목록의 "모집 종료" 뱃지와 어긋나지 않는다.
 */
function isRecruitClosed(
  campaign: { closedAt: string | null; recruitEndAt: string },
  now: number,
): boolean {
  return campaign.closedAt !== null || now > Date.parse(campaign.recruitEndAt);
}

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
        const now = Date.now();
        setCampaignOptions(
          rows.map((campaign) => ({
            id: campaign.id,
            title: campaign.title,
            closed: isRecruitClosed(campaign, now),
          })),
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
