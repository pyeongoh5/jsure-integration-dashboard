import { useEffect, useMemo, useState } from "react";
import { fetchCampaigns, jwinErrorMessage, type AdminCampaignListItem } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
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
  const t = useT();
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
          message: jwinErrorMessage(error, t("jwin.campaign.loadFailed")),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, t]);

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
