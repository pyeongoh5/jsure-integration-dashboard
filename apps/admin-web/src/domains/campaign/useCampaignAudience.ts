import { useCallback, useEffect, useState } from "react";
import type {
  CampaignAudienceEntry,
  CampaignAudienceInput,
} from "@jsure/shared";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { previewCampaignAudience, removeCampaignAudience } from "./api";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      audience: CampaignAudienceEntry[];
      /** 마스터에 없는 태그 라벨 — 저장은 거절되므로 미리 알린다. */
      unknownTagLabels: string[];
    };

/**
 * 대상자 실시간 프리뷰 + 개별 제외.
 *
 * 피커를 건드릴 때마다 서버에 다시 물어 "지금 저장하면 최종적으로 누가 대상인지"를
 * 보여준다. 승인자·태그 해석은 DB 를 봐야 알 수 있어서 화면에서 계산할 수 없다.
 * 제거는 낙관적 갱신 없이 서버 응답 후 다시 읽는다 — 화면과 DB 가 어긋나지 않는 쪽이
 * 중요하고, 인원은 수십~수백명 수준이라 다시 읽는 비용이 싸다.
 */
export function useCampaignAudience(
  campaignId: string | undefined,
  input: CampaignAudienceInput,
) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [removing, setRemoving] = useState<string | null>(null);
  // 입력 배열은 매 렌더 새 참조라 값으로 비교해야 요청이 무한히 반복되지 않는다.
  const inputKey = useDebouncedValue(JSON.stringify(input));

  const reload = useCallback(async () => {
    try {
      const result = await previewCampaignAudience({
        campaignId: campaignId ?? null,
        ...(JSON.parse(inputKey) as CampaignAudienceInput),
      });
      setState({
        kind: "ready",
        audience: result.audience,
        unknownTagLabels: result.unknownTagLabels,
      });
    } catch {
      setState({ kind: "error" });
    }
  }, [campaignId, inputKey]);

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
