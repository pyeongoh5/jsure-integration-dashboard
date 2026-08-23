import { useCallback, useEffect, useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import {
  fetchCampaign,
  createCampaign,
  updateCampaign,
  fetchBrandAccounts,
  jwinErrorMessage,
  type AdminCampaignDetail,
  type AdminBrandAccount,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
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

type JwinCampaignFormErrorKeys = Partial<Record<keyof JwinCampaignFormValues, AdminTranslationKey>>;

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

function validate(values: JwinCampaignFormValues): JwinCampaignFormErrorKeys {
  const errorKeys: JwinCampaignFormErrorKeys = {};
  if (!values.brandName.trim()) errorKeys.brandName = "jwin.basic.error.brandNameRequired";
  if (!values.slug.trim()) errorKeys.slug = "jwin.basic.error.slugRequired";
  else if (!/^[a-z0-9-]+$/.test(values.slug)) errorKeys.slug = "jwin.basic.error.slugFormat";
  if (!values.startsAt) errorKeys.startsAt = "jwin.basic.error.startsAtRequired";
  if (!values.endsAt) errorKeys.endsAt = "jwin.basic.error.endsAtRequired";
  if (values.startsAt && values.endsAt && values.endsAt <= values.startsAt) {
    errorKeys.endsAt = "jwin.basic.error.endsAtOrder";
  }
  if (values.dailyWinCap.trim() !== "") {
    const cap = Number(values.dailyWinCap);
    if (!Number.isInteger(cap) || cap <= 0) errorKeys.dailyWinCap = "jwin.basic.error.dailyWinCapInvalid";
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
  /** 저장 성공 시 캠페인 상세 반환 (생성이면 새 id 포함), 실패 시 null */
  save: () => Promise<AdminCampaignDetail | null>;
  reload: () => void;
  /** 연동 탭에서 고를 수 있는 브랜드 계정 목록 (편집 모드에서만 로드) */
  accounts: AdminBrandAccount[];
  accountsError: string | null;
  selectError: string | null;
  /** 캠페인에 브랜드 계정을 연결. 실패 시 selectError에 메시지가 채워진다. */
  selectAccount: (brandAccountId: string) => Promise<void>;
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
  const [accounts, setAccounts] = useState<AdminBrandAccount[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

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

  useEffect(() => {
    if (mode !== "edit") return;
    let cancelled = false;
    setAccountsError(null);
    fetchBrandAccounts()
      .then((result) => {
        if (cancelled) return;
        setAccounts(result.accounts);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAccountsError(jwinErrorMessage(error, t("jwin.connect.accountsLoadFailed")));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, t]);

  const selectAccount = useCallback(
    async (brandAccountId: string) => {
      if (!campaignId) return;
      setSelectError(null);
      try {
        const result = await updateCampaign(campaignId, { brandAccountId });
        setDetail(result);
      } catch (error: unknown) {
        setSelectError(jwinErrorMessage(error, t("jwin.connect.selectFailed")));
      }
    },
    [campaignId, t],
  );

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
    accounts,
    accountsError,
    selectError,
    selectAccount,
  };
}
