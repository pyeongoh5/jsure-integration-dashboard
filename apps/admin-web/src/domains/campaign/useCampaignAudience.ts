import { useCallback, useEffect, useState } from "react";
import type { CampaignAudienceEntry } from "@jsure/shared";
import { listCampaignAudience, removeCampaignAudience } from "./api";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; audience: CampaignAudienceEntry[] };

/**
 * 일부 공개 캠페인의 대상자 목록 + 개별 제외.
 * 제외는 낙관적 갱신 없이 서버 응답 후 목록을 다시 읽는다 — 대상 인원은 수십~수백명
 * 수준이라 다시 읽는 비용보다 화면과 DB 가 어긋나지 않는 쪽이 중요하다.
 */
export function useCampaignAudience(campaignId: string | undefined) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [removing, setRemoving] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!campaignId) return;
    try {
      const audience = await listCampaignAudience(campaignId);
      setState({ kind: "ready", audience });
    } catch {
      setState({ kind: "error" });
    }
  }, [campaignId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (influencerId: string) => {
      if (!campaignId) return;
      setRemoving(influencerId);
      try {
        await removeCampaignAudience(campaignId, influencerId);
        await reload();
      } finally {
        setRemoving(null);
      }
    },
    [campaignId, reload],
  );

  return { state, removing, remove, reload };
}
