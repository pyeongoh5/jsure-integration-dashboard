import { useState } from "react";
import { CampaignFormSchema, type CampaignForm as Values, type SnsType } from "@jsure/shared";
import { SnsTypeChips } from "./SnsTypeChips";
import { ReferenceMediaUrlList } from "./ReferenceMediaUrlList";
import "./CampaignForm.css";

export const EMPTY_CAMPAIGN_FORM: Values = {
  title: "",
  rewardJpy: 0,
  snsTypes: [],
  condition: "",
  recruitCount: 1,
  recruitStartDate: "",
  recruitEndDate: "",
  productSummary: "",
  productDetailUrl: "",
  guideline: "",
  referenceMediaUrls: [],
  ngItems: "",
  cautions: "",
};

type FieldErrors = Partial<Record<keyof Values, string>> & {
  referenceMediaUrls_items?: Record<number, string>;
};

type Props = {
  initialValue: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
};

function parseIntegerInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const n = Number(raw);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function CampaignForm({ initialValue, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Values>(initialValue);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const update = <K extends keyof Values>(key: K, v: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const result = CampaignFormSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      const urlItems: Record<number, string> = {};
      for (const issue of result.error.issues) {
        const [first, second] = issue.path;
        if (first === "referenceMediaUrls" && typeof second === "number") {
          urlItems[second] = issue.message;
        } else if (typeof first === "string") {
          next[first as keyof Values] = issue.message;
        }
      }
      if (Object.keys(urlItems).length > 0) next.referenceMediaUrls_items = urlItems;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      setBanner(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setSns = (next: SnsType[]) => update("snsTypes", next);

  return (
    <form className="cf" onSubmit={handleSubmit} noValidate>
      {banner && <div className="cf__banner">{banner}</div>}

      <section className="cf__section">
        <h2 className="cf__section-title">기본 정보</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-title">캠페인 제목</label>
          <input
            id="cf-title"
            className="cf__input"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            disabled={submitting}
          />
          {errors.title && <div className="cf__error">{errors.title}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-reward">보수 금액</label>
          <div className="cf__currency">
            <span className="cf__currency-prefix">¥</span>
            <input
              id="cf-reward"
              className="cf__input"
              inputMode="numeric"
              value={Number.isFinite(values.rewardJpy) ? String(values.rewardJpy) : ""}
              onChange={(e) => update("rewardJpy", parseIntegerInput(e.target.value))}
              disabled={submitting}
            />
            <span className="cf__currency-suffix">円</span>
          </div>
          {errors.rewardJpy && <div className="cf__error">{errors.rewardJpy}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label">SNS 종류</label>
          <SnsTypeChips value={values.snsTypes} onChange={setSns} disabled={submitting} />
          {errors.snsTypes && <div className="cf__error">{errors.snsTypes}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-condition">조건</label>
          <input
            id="cf-condition"
            className="cf__input"
            placeholder="예: 팔로워수 1,000명 이상"
            value={values.condition}
            onChange={(e) => update("condition", e.target.value)}
            disabled={submitting}
          />
          {errors.condition && <div className="cf__error">{errors.condition}</div>}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">모집</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-count">모집 인원</label>
          <input
            id="cf-count"
            className="cf__input"
            inputMode="numeric"
            value={Number.isFinite(values.recruitCount) ? String(values.recruitCount) : ""}
            onChange={(e) => update("recruitCount", parseIntegerInput(e.target.value))}
            disabled={submitting}
          />
          {errors.recruitCount && <div className="cf__error">{errors.recruitCount}</div>}
        </div>

        <div className="cf__row-2">
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-start">모집 시작일</label>
            <input
              id="cf-start"
              type="date"
              className="cf__input"
              value={values.recruitStartDate}
              onChange={(e) => update("recruitStartDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitStartDate && (
              <div className="cf__error">{errors.recruitStartDate}</div>
            )}
          </div>
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-end">모집 종료일</label>
            <input
              id="cf-end"
              type="date"
              className="cf__input"
              value={values.recruitEndDate}
              onChange={(e) => update("recruitEndDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitEndDate && (
              <div className="cf__error">{errors.recruitEndDate}</div>
            )}
          </div>
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">상품</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-product-summary">상품 개요</label>
          <textarea
            id="cf-product-summary"
            className="cf__textarea"
            value={values.productSummary}
            onChange={(e) => update("productSummary", e.target.value)}
            disabled={submitting}
          />
          {errors.productSummary && (
            <div className="cf__error">{errors.productSummary}</div>
          )}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-product-url">상품 상세 URL (qoo10)</label>
          <input
            id="cf-product-url"
            type="url"
            className="cf__input"
            placeholder="https://www.qoo10.jp/..."
            value={values.productDetailUrl}
            onChange={(e) => update("productDetailUrl", e.target.value)}
            disabled={submitting}
          />
          {errors.productDetailUrl && (
            <div className="cf__error">{errors.productDetailUrl}</div>
          )}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">가이드라인</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-guideline">안건 개요 (투고 가이드라인)</label>
          <textarea
            id="cf-guideline"
            className="cf__textarea"
            value={values.guideline}
            onChange={(e) => update("guideline", e.target.value)}
            disabled={submitting}
          />
          {errors.guideline && <div className="cf__error">{errors.guideline}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label">투고 참고 영상/사진 URL</label>
          <ReferenceMediaUrlList
            value={values.referenceMediaUrls}
            onChange={(next) => update("referenceMediaUrls", next)}
            disabled={submitting}
            errorByIndex={errors.referenceMediaUrls_items}
          />
          {errors.referenceMediaUrls && (
            <div className="cf__error">{errors.referenceMediaUrls}</div>
          )}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-ng">NG 사항</label>
          <textarea
            id="cf-ng"
            className="cf__textarea"
            value={values.ngItems}
            onChange={(e) => update("ngItems", e.target.value)}
            disabled={submitting}
          />
          {errors.ngItems && <div className="cf__error">{errors.ngItems}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-cautions">주의 사항</label>
          <textarea
            id="cf-cautions"
            className="cf__textarea"
            value={values.cautions}
            onChange={(e) => update("cautions", e.target.value)}
            disabled={submitting}
          />
          {errors.cautions && <div className="cf__error">{errors.cautions}</div>}
        </div>
      </section>

      <div className="cf__actions">
        <button
          type="button"
          className="cf__btn cf__btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          취소
        </button>
        <button type="submit" className="cf__btn" disabled={submitting}>
          {submitting ? "저장 중…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
