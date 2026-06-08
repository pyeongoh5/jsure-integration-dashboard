import { useState } from "react";
import { CampaignFormSchema, type CampaignForm as Values, type SnsRecruit } from "@jsure/shared";
import { SnsRecruitList } from "./SnsRecruitList";
import { ReferenceMediaUrlList } from "./ReferenceMediaUrlList";
import { uploadCampaignThumbnail, UploadError } from "../../lib/uploads";
import { RichTextEditor } from "../common/RichTextEditor";
import { serializeRichTextHtml } from "../../lib/richTextImages";

const CAMPAIGN_IMAGE_ENDPOINT = "/uploads/admin/campaign-image/presign";
import "./CampaignForm.css";

export const EMPTY_CAMPAIGN_FORM: Values = {
  title: "",
  rewardJpy: 0,
  recruitStartDate: "",
  recruitEndDate: "",
  postingPeriodDays: Number.NaN,
  snsRecruits: [],
  productSummary: "",
  productDetailUrl: "",
  guideline: "",
  referenceMediaUrls: [],
  cautions: "",
  thumbnailUrl: null,
};

type SnsRecruitItemError = Partial<Record<"minFollowers" | "recruitCount", string>>;

type FieldErrors = Partial<Record<keyof Values, string>> & {
  referenceMediaUrls_items?: Record<number, string>;
  snsRecruits_items?: Record<number, SnsRecruitItemError>;
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
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  type ThumbnailDraft =
    | { kind: "unchanged" }
    | { kind: "new"; objectKey: string; viewUrl: string }
    | { kind: "removed" };
  const [thumbnailDraft, setThumbnailDraft] = useState<ThumbnailDraft>({
    kind: "unchanged",
  });

  const thumbnailPreviewSrc: string | null =
    thumbnailDraft.kind === "new"
      ? thumbnailDraft.viewUrl
      : thumbnailDraft.kind === "removed"
        ? null
        : (initialValue.thumbnailUrl ?? null);

  const handleThumbnailFile = async (file: File | null) => {
    if (!file) return;
    setThumbnailError(null);
    setUploadingThumbnail(true);
    try {
      const { objectKey, viewUrl } = await uploadCampaignThumbnail(file);
      setThumbnailDraft({ kind: "new", objectKey, viewUrl });
    } catch (uploadError) {
      setThumbnailError(
        uploadError instanceof UploadError
          ? uploadError.message
          : "업로드에 실패했습니다",
      );
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const removeThumbnail = () => {
    setThumbnailError(null);
    setThumbnailDraft({ kind: "removed" });
  };

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
      const recruitItems: Record<number, SnsRecruitItemError> = {};
      for (const issue of result.error.issues) {
        const [first, second, third] = issue.path;
        if (first === "referenceMediaUrls" && typeof second === "number") {
          urlItems[second] = issue.message;
        } else if (
          first === "snsRecruits" &&
          typeof second === "number" &&
          (third === "minFollowers" || third === "recruitCount")
        ) {
          const prev = recruitItems[second] ?? {};
          recruitItems[second] = { ...prev, [third]: issue.message };
        } else if (typeof first === "string") {
          next[first as keyof Values] = issue.message;
        }
      }
      if (Object.keys(urlItems).length > 0) next.referenceMediaUrls_items = urlItems;
      if (Object.keys(recruitItems).length > 0) next.snsRecruits_items = recruitItems;
      setErrors(next);
      return;
    }
    // 업로드가 끝나지 않은 이미지 (data-r2-key 없는 img) 차단
    const pending = [values.productSummary, values.guideline, values.cautions];
    if (pending.some((html) => /<img\b(?![^>]*\bdata-r2-key=)[^>]*>/.test(html))) {
      setBanner("이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const finalValues: Values = {
        ...result.data,
        // 본문 이미지는 r2:KEY 로 직렬화해서 저장
        productSummary: serializeRichTextHtml(result.data.productSummary),
        guideline: serializeRichTextHtml(result.data.guideline),
        cautions: serializeRichTextHtml(result.data.cautions),
      };
      if (thumbnailDraft.kind === "new") {
        finalValues.thumbnailUrl = thumbnailDraft.objectKey;
      } else if (thumbnailDraft.kind === "removed") {
        finalValues.thumbnailUrl = null;
      } else {
        delete finalValues.thumbnailUrl;
      }
      await onSubmit(finalValues);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const setSnsRecruits = (next: SnsRecruit[]) => update("snsRecruits", next);

  return (
    <form className="cf" onSubmit={handleSubmit} noValidate>
      {banner && <div className="cf__banner">{banner}</div>}

      <section className="cf__section">
        <h2 className="cf__section-title">기본 정보</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-title">
            캠페인 제목
          </label>
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
          <label className="cf__label" htmlFor="cf-reward">
            보수 금액
          </label>
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

        <div className="cf__row-2">
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-start">
              모집 시작일
            </label>
            <input
              id="cf-start"
              type="date"
              className="cf__input"
              value={values.recruitStartDate}
              onChange={(e) => update("recruitStartDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitStartDate && <div className="cf__error">{errors.recruitStartDate}</div>}
          </div>
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-end">
              모집 종료일
            </label>
            <input
              id="cf-end"
              type="date"
              className="cf__input"
              value={values.recruitEndDate}
              onChange={(e) => update("recruitEndDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitEndDate && <div className="cf__error">{errors.recruitEndDate}</div>}
          </div>
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-posting-period">
            게시 기간 (수령 후 N일)
          </label>
          <input
            id="cf-posting-period"
            className="cf__input"
            inputMode="numeric"
            placeholder="예시: 14"
            value={
              Number.isFinite(values.postingPeriodDays) ? String(values.postingPeriodDays) : ""
            }
            onChange={(e) => update("postingPeriodDays", parseIntegerInput(e.target.value))}
            disabled={submitting}
          />
          {errors.postingPeriodDays && <div className="cf__error">{errors.postingPeriodDays}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-thumbnail">
            썸네일 이미지 (인플루언서 앱 표시용)
          </label>
          <div className="cf__thumbnail">
            {thumbnailPreviewSrc && (
              <div className="cf__thumbnail-preview">
                <img src={thumbnailPreviewSrc} alt="썸네일" />
                <button
                  type="button"
                  className="cf__thumbnail-remove"
                  onClick={removeThumbnail}
                  disabled={submitting || uploadingThumbnail}
                >
                  제거
                </button>
              </div>
            )}
            <input
              id="cf-thumbnail"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="cf__file"
              disabled={submitting || uploadingThumbnail}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void handleThumbnailFile(file);
              }}
            />
            <p className="cf__hint">PNG · JPEG · WebP, 5MB 이하</p>
            {uploadingThumbnail && (
              <div className="cf__hint">업로드 중...</div>
            )}
            {thumbnailError && <div className="cf__error">{thumbnailError}</div>}
          </div>
          {errors.thumbnailUrl && <div className="cf__error">{errors.thumbnailUrl}</div>}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">SNS별 모집</h2>
        <p className="cf__sub-label">
          사용할 SNS를 선택하고, 각 SNS에 적용할 조건과 모집 인원을 입력하세요.
        </p>
        <SnsRecruitList
          value={values.snsRecruits}
          onChange={setSnsRecruits}
          disabled={submitting}
          errorByIndex={errors.snsRecruits_items}
        />
        {errors.snsRecruits && <div className="cf__error">{errors.snsRecruits}</div>}
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">상품</h2>

        <div className="cf__field">
          <label className="cf__label">상품 개요</label>
          <RichTextEditor
            value={values.productSummary}
            onChange={(html) => update("productSummary", html)}
            disabled={submitting}
            minHeight={160}
            imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
          />
          {errors.productSummary && <div className="cf__error">{errors.productSummary}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-product-url">
            상품 상세 URL (qoo10)
          </label>
          <input
            id="cf-product-url"
            type="url"
            className="cf__input"
            placeholder="https://www.qoo10.jp/..."
            value={values.productDetailUrl}
            onChange={(e) => update("productDetailUrl", e.target.value)}
            disabled={submitting}
          />
          {errors.productDetailUrl && <div className="cf__error">{errors.productDetailUrl}</div>}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">가이드라인</h2>

        <div className="cf__field">
          <label className="cf__label">안건 개요 (투고 가이드라인)</label>
          <RichTextEditor
            value={values.guideline}
            onChange={(html) => update("guideline", html)}
            disabled={submitting}
            minHeight={220}
            imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
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
          <label className="cf__label">NG 및 주의 사항</label>
          <RichTextEditor
            value={values.cautions}
            onChange={(html) => update("cautions", html)}
            disabled={submitting}
            minHeight={200}
            imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
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
