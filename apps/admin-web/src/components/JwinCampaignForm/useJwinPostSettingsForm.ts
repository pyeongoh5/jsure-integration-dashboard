import { useEffect, useState } from "react";
import {
  jwinErrorMessage,
  updateBrandCampaign,
  type AdminBrandCampaignDetail,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type JwinPostSettingsValues = {
  cardImageUrl: string | null;
  rulesUrl: string;
};

export type UseJwinPostSettingsFormResult = {
  values: JwinPostSettingsValues;
  setField: <Field extends keyof JwinPostSettingsValues>(
    field: Field,
    value: JwinPostSettingsValues[Field],
  ) => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  save: () => Promise<void>;
};

function toValues(detail: AdminBrandCampaignDetail): JwinPostSettingsValues {
  return {
    cardImageUrl: detail.cardImageUrl,
    rulesUrl: detail.rulesUrl ?? "",
  };
}

/**
 * 포스트 전체에 공통으로 걸리는 캠페인 단위 설정 — 링크 카드 이미지와 이벤트 규칙 링크.
 * 포스트(PostTemplate)가 아니라 캠페인 PATCH 로 저장한다.
 */
export function useJwinPostSettingsForm(
  detail: AdminBrandCampaignDetail,
  onSaved: () => void,
): UseJwinPostSettingsFormResult {
  const t = useT();
  const [values, setValues] = useState<JwinPostSettingsValues>(() => toValues(detail));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toValues(detail));
  }, [detail]);

  const setField = <Field extends keyof JwinPostSettingsValues>(
    field: Field,
    value: JwinPostSettingsValues[Field],
  ) => {
    setSaved(false);
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateBrandCampaign(detail.id, {
        cardImageUrl: values.cardImageUrl,
        // 빈 문자열은 서버 z.string().url() 을 통과하지 못한다
        rulesUrl: values.rulesUrl.trim() === "" ? null : values.rulesUrl.trim(),
      });
      onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.common.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return { values, setField, saving, saved, error, save };
}
