import { useCallback, useEffect, useState } from "react";
import {
  fetchBrandCampaign,
  jwinErrorMessage,
  MAX_WIN_PROBABILITY,
  updateBrandCampaign,
  type AdminBrandCampaignDetail,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import {
  formatProbabilityPercent,
  probabilityToPercentInput,
  winProbabilityAutosave,
} from "./winProbability";

/** 입력이 멈춘 뒤 자동 저장까지의 대기 시간. */
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * 참여(BrandCampaign) 상세 로드 + 추첨 설정 저장.
 * 기간·이름·게시 시각은 시즌이 갖고, 여기서는 기준 당첨확률만 다룬다.
 */
export type JwinBrandCampaignFormValues = {
  /** 퍼센트 표기 ("0.5" = 0.5%) — 저장 시 0~1 로 환산한다 */
  winProbabilityPercent: string;
};

export type UseJwinBrandCampaignResult = {
  loading: boolean;
  loadError: string | null;
  detail: AdminBrandCampaignDetail | null;
  values: JwinBrandCampaignFormValues;
  setField: <Field extends keyof JwinBrandCampaignFormValues>(
    field: Field,
    value: JwinBrandCampaignFormValues[Field],
  ) => void;
  error: string | null;
  saving: boolean;
  saved: boolean;
  /** 다른 탭이 PATCH 로 갱신했을 때 상세를 갈아끼운다 */
  applyDetail: (updated: AdminBrandCampaignDetail) => void;
  reload: () => void;
};

function toValues(detail: AdminBrandCampaignDetail): JwinBrandCampaignFormValues {
  return { winProbabilityPercent: probabilityToPercentInput(detail.winProbability) };
}

export function useJwinBrandCampaign(brandCampaignId: string): UseJwinBrandCampaignResult {
  const t = useT();
  const [detail, setDetail] = useState<AdminBrandCampaignDetail | null>(null);
  const [values, setValues] = useState<JwinBrandCampaignFormValues>({
    winProbabilityPercent: "",
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
    <Field extends keyof JwinBrandCampaignFormValues>(
      field: Field,
      value: JwinBrandCampaignFormValues[Field],
    ) => {
      setSaved(false);
      setValues((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const applyDetail = useCallback((updated: AdminBrandCampaignDetail) => {
    setDetail(updated);
    setValues(toValues(updated));
  }, []);

  // 디바운스 자동 저장 — 입력이 멈춘 뒤 유효하고 저장값과 다를 때만 PATCH.
  // 저장 후 values 는 건드리지 않는다(입력 중인 값을 서버 응답으로 덮지 않기 위함).
  useEffect(() => {
    if (!detail) return;
    const decision = winProbabilityAutosave(
      values.winProbabilityPercent,
      detail.winProbability,
      MAX_WIN_PROBABILITY,
    );
    if (decision.kind === "invalid") {
      setError(
        t("jwin.basic.error.winProbabilityInvalid", {
          max: formatProbabilityPercent(MAX_WIN_PROBABILITY),
        }),
      );
      return;
    }
    setError(null);
    if (decision.kind === "skip") return;
    const timer = window.setTimeout(() => {
      setSaving(true);
      updateBrandCampaign(detail.id, { winProbability: decision.winProbability })
        .then((updated) => {
          setDetail(updated);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        })
        .catch((caught: unknown) => {
          setError(jwinErrorMessage(caught, t("jwin.common.saveFailed")));
        })
        .finally(() => {
          setSaving(false);
        });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [detail, values.winProbabilityPercent, t]);

  return {
    loading,
    loadError,
    detail,
    values,
    setField,
    error,
    saving,
    saved,
    applyDetail,
    reload: () => setReloadKey((current) => current + 1),
  };
}
