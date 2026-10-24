import { useEffect, useState } from "react";
import {
  fetchBrandCampaigns,
  jwinErrorMessage,
  type AdminBrandCampaignListItem,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinBrandCampaignsDataResult = {
  loading: boolean;
  loadError: string | null;
  rows: AdminBrandCampaignListItem[];
};

/** 시즌에 참여 중인 브랜드 목록. campaignId 가 null 이면 빈 목록. */
export function useJwinBrandCampaignsData(
  campaignId: string | null,
): UseJwinBrandCampaignsDataResult {
  const t = useT();
  const [rows, setRows] = useState<AdminBrandCampaignListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // 시즌이 바뀌면 이전 시즌 목록을 즉시 버린다 — 남겨두면 호출부의 "첫 브랜드
    // 자동 선택"이 이전 시즌 브랜드를 집어 조회 키와 화면 선택이 어긋난다.
    setRows([]);
    fetchBrandCampaigns(campaignId)
      .then((result) => {
        if (!cancelled) setRows(result.brandCampaigns);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(jwinErrorMessage(caught, t("jwin.campaign.brands.loadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  return { loading, loadError, rows };
}
