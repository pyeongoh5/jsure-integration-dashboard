import { useState } from "react";
import {
  jwinErrorMessage,
  updateBrandCampaign,
  type AdminBrandCampaignDetail,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type JwinCampaignStatus = AdminBrandCampaignDetail["status"];

/** 상태 전환은 참여(BrandCampaign) 단위다 — 시즌에는 상태가 없다. */
export function useJwinStatusTransition(
  brandCampaignId: string,
  onChanged: (updated: AdminBrandCampaignDetail) => void,
) {
  const t = useT();
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (status: JwinCampaignStatus) => {
    setChanging(true);
    setError(null);
    try {
      const updated = await updateBrandCampaign(brandCampaignId, { status });
      onChanged(updated);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.status.changeFailed")));
    } finally {
      setChanging(false);
    }
  };

  return { changing, error, change };
}
