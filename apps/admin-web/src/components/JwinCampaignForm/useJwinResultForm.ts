import { useEffect, useState } from "react";
import {
  jwinErrorMessage,
  updateBrandCampaign,
  type AdminBrandCampaignDetail,
  type AdminBrandCampaignPatch,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { dmTemplateMissingCode } from "./dmTemplatePreview";

export const DM_TEMPLATE_MAX_LENGTH = 1000;

export type JwinResultFormValues = {
  winMediaUrl: string | null;
  loseMediaUrl: string | null;
  prUrl: string;
  dmTemplate: string;
};

export type UseJwinResultFormResult = {
  values: JwinResultFormValues;
  setField: <Field extends keyof JwinResultFormValues>(
    field: Field,
    value: JwinResultFormValues[Field],
  ) => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  /** 저장을 막는 사유. null 이면 저장 가능 */
  blockedReason: string | null;
  save: () => Promise<void>;
};

function toValues(detail: AdminBrandCampaignDetail): JwinResultFormValues {
  return {
    winMediaUrl: detail.winMediaUrl,
    loseMediaUrl: detail.loseMediaUrl,
    prUrl: detail.prUrl ?? "",
    dmTemplate: detail.dmTemplate ?? "",
  };
}

/**
 * 결과화면·DM 필드는 캠페인 PATCH 로 저장한다.
 *
 * CODE 경품이 있는데 DM 문구에 {{CODE}} 가 없으면 **저장 자체를 막는다** — 코드 없는 DM 이
 * 나가면 당첨자는 "축하합니다"만 받고 경품을 못 받는다. 자동 발송이라 되돌릴 수도 없다.
 * 문구가 비어 있으면 서버 기본 문구({{CODE}} 포함)가 쓰이므로 막지 않는다.
 */
export function useJwinResultForm(
  detail: AdminBrandCampaignDetail,
  hasCodePrize: boolean,
  onSaved: (updated: AdminBrandCampaignDetail) => void,
): UseJwinResultFormResult {
  const t = useT();
  const [values, setValues] = useState<JwinResultFormValues>(() => toValues(detail));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toValues(detail));
  }, [detail]);

  const setField = <Field extends keyof JwinResultFormValues>(
    field: Field,
    value: JwinResultFormValues[Field],
  ) => {
    setSaved(false);
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const blockedReason = (): string | null => {
    if (values.dmTemplate.length > DM_TEMPLATE_MAX_LENGTH) {
      return t("jwin.result.blockedTooLong", { max: DM_TEMPLATE_MAX_LENGTH });
    }
    if (hasCodePrize && dmTemplateMissingCode(values.dmTemplate)) {
      return t("jwin.result.blockedMissingCode");
    }
    return null;
  };

  const save = async () => {
    if (blockedReason()) return;
    const body: AdminBrandCampaignPatch = {
      winMediaUrl: values.winMediaUrl,
      loseMediaUrl: values.loseMediaUrl,
      // 빈 문자열은 서버 z.string().url() 을 통과하지 못한다
      prUrl: values.prUrl.trim() === "" ? null : values.prUrl.trim(),
      dmTemplate: values.dmTemplate.trim() === "" ? null : values.dmTemplate,
    };
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBrandCampaign(detail.id, body);
      onSaved(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.common.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return { values, setField, saving, saved, error, blockedReason: blockedReason(), save };
}
