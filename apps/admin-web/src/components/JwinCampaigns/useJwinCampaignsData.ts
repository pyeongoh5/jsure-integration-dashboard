import { useEffect, useMemo, useState } from "react";
import { fetchCampaigns, type AdminCampaignListItem } from "@/domains/jwin";
import { toJwinCampaignRow, type JwinCampaignRow } from "./jwinCampaignTransform";

export type JwinCampaignsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; items: AdminCampaignListItem[] }
  | { kind: "error"; message: string };

export type UseJwinCampaignsDataResult = {
  state: JwinCampaignsLoadState;
  rows: JwinCampaignRow[];
  reload: () => void;
};

export function useJwinCampaignsData(): UseJwinCampaignsDataResult {
  const [state, setState] = useState<JwinCampaignsLoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchCampaigns()
      .then((result) => {
        if (!cancelled) setState({ kind: "ready", items: result.campaigns });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "캠페인 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rows = useMemo<JwinCampaignRow[]>(() => {
    if (state.kind !== "ready") return [];
    return state.items.map(toJwinCampaignRow);
  }, [state]);

  return {
    state,
    rows,
    reload: () => setReloadKey((current) => current + 1),
  };
}
