import { useState } from "react";
import { jwinErrorMessage, updateCampaign, type AdminCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type JwinCampaignStatus = AdminCampaignDetail["status"];

export function useJwinStatusTransition(
  campaignId: string,
  onChanged: (updated: AdminCampaignDetail) => void,
) {
  const t = useT();
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (status: JwinCampaignStatus) => {
    setChanging(true);
    setError(null);
    try {
      const updated = await updateCampaign(campaignId, { status });
      onChanged(updated);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.status.changeFailed")));
    } finally {
      setChanging(false);
    }
  };

  return { changing, error, change };
}
