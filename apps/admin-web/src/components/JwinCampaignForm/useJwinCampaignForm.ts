import { useCallback, useEffect, useState } from "react";
import {
  fetchCampaign,
  createCampaign,
  updateCampaign,
  type AdminCampaignDetail,
} from "@/domains/jwin";
import { utcIsoToJstLocal, jstLocalToUtcIso } from "./jwinDateTime";

export type JwinCampaignFormValues = {
  brandName: string;
  slug: string;
  /** JST datetime-local "YYYY-MM-DDTHH:mm" */
  startsAt: string;
  endsAt: string;
  /** "HH:mm" */
  dailyPostTime: string;
  /** "" = 무제한 */
  dailyWinCap: string;
};

export type JwinCampaignFormErrors = Partial<Record<keyof JwinCampaignFormValues, string>>;

const EMPTY: JwinCampaignFormValues = {
  brandName: "",
  slug: "",
  startsAt: "",
  endsAt: "",
  dailyPostTime: "11:00",
  dailyWinCap: "",
};

function toFormValues(detail: AdminCampaignDetail): JwinCampaignFormValues {
  return {
    brandName: detail.brandName,
    slug: detail.slug,
    startsAt: utcIsoToJstLocal(detail.startsAt),
    endsAt: utcIsoToJstLocal(detail.endsAt),
    dailyPostTime: detail.dailyPostTime,
    dailyWinCap: detail.dailyWinCap === null ? "" : String(detail.dailyWinCap),
  };
}

function validate(values: JwinCampaignFormValues): JwinCampaignFormErrors {
  const errors: JwinCampaignFormErrors = {};
  if (!values.brandName.trim()) errors.brandName = "브랜드명을 입력하세요.";
  if (!values.slug.trim()) errors.slug = "slug를 입력하세요.";
  else if (!/^[a-z0-9-]+$/.test(values.slug)) errors.slug = "영소문자·숫자·하이픈만 사용할 수 있습니다.";
  if (!values.startsAt) errors.startsAt = "시작일시를 입력하세요.";
  if (!values.endsAt) errors.endsAt = "종료일시를 입력하세요.";
  if (values.startsAt && values.endsAt && values.endsAt <= values.startsAt) {
    errors.endsAt = "종료일시는 시작일시 이후여야 합니다.";
  }
  if (values.dailyWinCap.trim() !== "") {
    const cap = Number(values.dailyWinCap);
    if (!Number.isInteger(cap) || cap <= 0) errors.dailyWinCap = "1 이상의 정수를 입력하세요.";
  }
  return errors;
}

export type UseJwinCampaignFormResult = {
  mode: "new" | "edit";
  loading: boolean;
  loadError: string | null;
  detail: AdminCampaignDetail | null;
  values: JwinCampaignFormValues;
  setField: (field: keyof JwinCampaignFormValues, value: string) => void;
  errors: JwinCampaignFormErrors;
  saving: boolean;
  saveError: string | null;
  /** 저장 성공 시 캠페인 상세 반환 (생성이면 새 id 포함), 실패 시 null */
  save: () => Promise<AdminCampaignDetail | null>;
  reload: () => void;
};

export function useJwinCampaignForm(campaignId: string | undefined): UseJwinCampaignFormResult {
  const mode = campaignId ? "edit" : "new";
  const [values, setValues] = useState<JwinCampaignFormValues>(EMPTY);
  const [detail, setDetail] = useState<AdminCampaignDetail | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<JwinCampaignFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchCampaign(campaignId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setValues(toFormValues(result));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "캠페인을 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey]);

  const setField = useCallback((field: keyof JwinCampaignFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(async (): Promise<AdminCampaignDetail | null> => {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const body = {
      brandName: values.brandName.trim(),
      slug: values.slug.trim(),
      startsAt: jstLocalToUtcIso(values.startsAt),
      endsAt: jstLocalToUtcIso(values.endsAt),
      dailyPostTime: values.dailyPostTime,
      dailyWinCap: values.dailyWinCap.trim() === "" ? null : Number(values.dailyWinCap),
    };

    setSaving(true);
    setSaveError(null);
    try {
      const result = campaignId
        ? await updateCampaign(campaignId, body)
        : await createCampaign(body);
      setDetail(result);
      return result;
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "저장에 실패했습니다.");
      return null;
    } finally {
      setSaving(false);
    }
  }, [campaignId, values]);

  return {
    mode,
    loading,
    loadError,
    detail,
    values,
    setField,
    errors,
    saving,
    saveError,
    save,
    reload: () => setReloadKey((current) => current + 1),
  };
}
