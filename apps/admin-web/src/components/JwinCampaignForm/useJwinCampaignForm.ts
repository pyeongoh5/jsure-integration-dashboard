import { useCallback, useEffect, useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import {
  fetchCampaign,
  createCampaign,
  updateCampaign,
  jwinErrorMessage,
  type AdminCampaignDetail,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { utcIsoToJstLocal, jstLocalToUtcIso } from "./jwinDateTime";

/** 시즌 캠페인 폼 — 이름·slug·기간. 게시 설정과 상태는 참여(BrandCampaign)가 갖는다. */
export type JwinCampaignFormValues = {
  name: string;
  slug: string;
  /** JST datetime-local "YYYY-MM-DDTHH:mm" */
  startsAt: string;
  endsAt: string;
};

export type JwinCampaignFormErrors = Partial<Record<keyof JwinCampaignFormValues, string>>;

type JwinCampaignFormErrorKeys = Partial<Record<keyof JwinCampaignFormValues, AdminTranslationKey>>;

const EMPTY: JwinCampaignFormValues = {
  name: "",
  slug: "",
  startsAt: "",
  endsAt: "",
};

function toFormValues(detail: AdminCampaignDetail): JwinCampaignFormValues {
  return {
    name: detail.name,
    slug: detail.slug,
    startsAt: utcIsoToJstLocal(detail.startsAt),
    endsAt: utcIsoToJstLocal(detail.endsAt),
  };
}

function validate(values: JwinCampaignFormValues): JwinCampaignFormErrorKeys {
  const errorKeys: JwinCampaignFormErrorKeys = {};
  if (!values.name.trim()) errorKeys.name = "jwin.basic.error.nameRequired";
  if (!values.slug.trim()) errorKeys.slug = "jwin.basic.error.slugRequired";
  else if (!/^[a-z0-9-]+$/.test(values.slug)) errorKeys.slug = "jwin.basic.error.slugFormat";
  if (!values.startsAt) errorKeys.startsAt = "jwin.basic.error.startsAtRequired";
  if (!values.endsAt) errorKeys.endsAt = "jwin.basic.error.endsAtRequired";
  if (values.startsAt && values.endsAt && values.endsAt <= values.startsAt) {
    errorKeys.endsAt = "jwin.basic.error.endsAtOrder";
  }
  return errorKeys;
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
  /** 저장 성공 시 시즌 상세 반환 (생성이면 새 id 포함), 실패 시 null */
  save: () => Promise<AdminCampaignDetail | null>;
  reload: () => void;
};

export function useJwinCampaignForm(campaignId: string | undefined): UseJwinCampaignFormResult {
  const t = useT();
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
        setLoadError(jwinErrorMessage(error, t("jwin.campaign.detailLoadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey, t]);

  const setField = useCallback((field: keyof JwinCampaignFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(async (): Promise<AdminCampaignDetail | null> => {
    const nextErrorKeys = validate(values);
    const nextErrors: JwinCampaignFormErrors = {};
    for (const [field, key] of Object.entries(nextErrorKeys)) {
      nextErrors[field as keyof JwinCampaignFormValues] = t(key as AdminTranslationKey);
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrorKeys).length > 0) return null;

    const body = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      startsAt: jstLocalToUtcIso(values.startsAt),
      endsAt: jstLocalToUtcIso(values.endsAt),
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
      setSaveError(jwinErrorMessage(error, t("jwin.common.saveFailed")));
      return null;
    } finally {
      setSaving(false);
    }
  }, [campaignId, values, t]);

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
