import { useCallback, useEffect, useState } from "react";
import {
  fetchBrandCampaign,
  jwinErrorMessage,
  updateBrandCampaign,
  type AdminBrandCampaignDetail,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

/**
 * 참여(BrandCampaign) 상세 로드 + 게시 설정 저장.
 * 기간·이름은 시즌이 갖고, 여기서는 게시 시각과 일일 당첨 상한만 다룬다.
 */
export type JwinBrandCampaignFormValues = {
  /** "HH:mm" */
  dailyPostTime: string;
  /** "" = 무제한 */
  dailyWinCap: string;
};

export type UseJwinBrandCampaignResult = {
  loading: boolean;
  loadError: string | null;
  detail: AdminBrandCampaignDetail | null;
  values: JwinBrandCampaignFormValues;
  setField: (field: keyof JwinBrandCampaignFormValues, value: string) => void;
  error: string | null;
  saving: boolean;
  saved: boolean;
  save: () => Promise<void>;
  /** 다른 탭이 PATCH 로 갱신했을 때 상세를 갈아끼운다 */
  applyDetail: (updated: AdminBrandCampaignDetail) => void;
  reload: () => void;
};

function toValues(detail: AdminBrandCampaignDetail): JwinBrandCampaignFormValues {
  return {
    dailyPostTime: detail.dailyPostTime,
    dailyWinCap: detail.dailyWinCap === null ? "" : String(detail.dailyWinCap),
  };
}

export function useJwinBrandCampaign(brandCampaignId: string): UseJwinBrandCampaignResult {
  const t = useT();
  const [detail, setDetail] = useState<AdminBrandCampaignDetail | null>(null);
  const [values, setValues] = useState<JwinBrandCampaignFormValues>({
    dailyPostTime: "11:00",
    dailyWinCap: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchBrandCampaign(brandCampaignId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setValues(toValues(result));
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(jwinErrorMessage(caught, t("jwin.campaign.detailLoadFailed")));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandCampaignId, reloadKey, t]);

  const setField = useCallback(
    (field: keyof JwinBrandCampaignFormValues, value: string) => {
      setSaved(false);
      setValues((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const applyDetail = useCallback((updated: AdminBrandCampaignDetail) => {
    setDetail(updated);
    setValues(toValues(updated));
  }, []);

  const save = useCallback(async () => {
    if (!detail) return;
    const cap = values.dailyWinCap.trim();
    if (cap !== "" && (!Number.isInteger(Number(cap)) || Number(cap) <= 0)) {
      setError(t("jwin.basic.error.dailyWinCapInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBrandCampaign(detail.id, {
        dailyPostTime: values.dailyPostTime,
        dailyWinCap: cap === "" ? null : Number(cap),
      });
      applyDetail(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.common.saveFailed")));
    } finally {
      setSaving(false);
    }
  }, [applyDetail, detail, values, t]);

  return {
    loading,
    loadError,
    detail,
    values,
    setField,
    error,
    saving,
    saved,
    save,
    applyDetail,
    reload: () => setReloadKey((current) => current + 1),
  };
}
