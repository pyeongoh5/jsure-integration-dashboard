import { useEffect, useState } from "react";
import { formatTitleWithTags } from "@jsure/shared";
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
          new Map(
            rows.map((campaign) => [
              campaign.id,
              formatTitleWithTags(campaign.tags, campaign.title),
            ]),
          ),
        );
        const now = Date.now();
        // 필터 목록은 태그를 배지로 그리므로 제목과 태그를 따로 넘긴다.
        // campaignTitleById 는 칩의 선택 라벨(문자열)이라 합친 표기를 유지한다.
        setCampaignOptions(
          rows.map((campaign) => ({
            id: campaign.id,
            title: campaign.title,
            tags: campaign.tags,
            closed: isRecruitClosed(campaign, now),
          })),
        );
      })
      .catch((cause: unknown) => {
        // 조용히 비우면 필터가 "캠페인이 없습니다" 로 보여 원인을 알 수 없다.
        // 응답 스키마 위반은 목록 전체를 날리므로 콘솔에 남긴다.
        console.error("캠페인 목록을 불러오지 못했습니다", cause);
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
