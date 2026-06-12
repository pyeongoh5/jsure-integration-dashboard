import { useEffect, useState } from "react";
import { useForm, FormProvider, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CampaignFormSchema,
  type CampaignForm as Values,
  type CampaignResponse,
} from "@jsure/shared";
import { SnsRecruitList } from "./SnsRecruitList";
import { ReferenceMediaUrlList } from "./ReferenceMediaUrlList";
import { ExcludedCampaignsPicker } from "./ExcludedCampaignsPicker";
import { uploadCampaignThumbnail, UploadError } from "@/lib/uploads";
import { listCampaigns } from "../api";
import { RichTextEditor } from "@/components/composites/RichTextEditor/RichTextEditor";
import { serializeRichTextHtml } from "@/lib/richTextImages";
import "./CampaignForm.css";

const CAMPAIGN_IMAGE_ENDPOINT = "/uploads/admin/campaign-image/presign";

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
  excludedCampaignIds: [],
};

type SnsRecruitItemError = Partial<
  Record<"minFollowers" | "recruitCount", string>
>;

interface PerItemErrors {
  referenceMediaUrls?: Record<number, string>;
  snsRecruits?: Record<number, SnsRecruitItemError>;
}

type Props = {
  initialValue: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
  selfCampaignId?: string;
};

function parseIntegerInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

type ThumbnailDraft =
  | { kind: "unchanged" }
  | { kind: "new"; objectKey: string; viewUrl: string }
  | { kind: "removed" };

export function CampaignForm({
  initialValue,
  submitLabel,
  onSubmit,
  onCancel,
  selfCampaignId,
}: Props) {
  const methods = useForm<Values>({
    resolver: zodResolver(CampaignFormSchema) as unknown as Resolver<Values>,
    defaultValues: initialValue,
  });
  const [allCampaigns, setAllCampaigns] = useState<CampaignResponse[] | null>(
    null,
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailDraft, setThumbnailDraft] = useState<ThumbnailDraft>({
    kind: "unchanged",
  });
  const [perItemErrors, setPerItemErrors] = useState<PerItemErrors>({});

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then((rows) => {
        if (!cancelled) setAllCampaigns(rows);
      })
      .catch(() => {
        if (!cancelled) setAllCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const thumbnailPreviewSrc: string | null =
    thumbnailDraft.kind === "new"
      ? thumbnailDraft.viewUrl
      : thumbnailDraft.kind === "removed"
        ? null
        : (initialValue.thumbnailUrl ?? null);

  async function handleThumbnailFile(file: File | null) {
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
  }

  function removeThumbnail() {
    setThumbnailError(null);
    setThumbnailDraft({ kind: "removed" });
  }

  const submitting = methods.formState.isSubmitting;
  const fieldErrors = methods.formState.errors;

  function rootError(name: keyof Values): string | undefined {
    const issue = fieldErrors[name];
    if (!issue) return undefined;
    return typeof issue.message === "string" ? issue.message : undefined;
  }

  async function submit(values: Values) {
    setBanner(null);
    // RHF가 검증을 통과시킨 시점이므로 perItemErrors도 초기화
    setPerItemErrors({});

    // 업로드가 끝나지 않은 이미지 (data-r2-key 없는 img) 차단
    const pending = [values.productSummary, values.guideline, values.cautions];
    if (
      pending.some((html) =>
        /<img\b(?![^>]*\bdata-r2-key=)[^>]*>/.test(html),
      )
    ) {
      setBanner(
        "이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }
    try {
      const finalValues: Values = {
        ...values,
        productSummary: serializeRichTextHtml(values.productSummary),
        guideline: serializeRichTextHtml(values.guideline),
        cautions: serializeRichTextHtml(values.cautions),
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
      setBanner(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
      );
    }
  }

  function onInvalid() {
    // zod 의 array index 에러를 RHF formState 가 아닌 별도 state 에 풀어서 보존
    const items: PerItemErrors = {};
    const flatten = (
      node: unknown,
      pathHead: string,
    ): void => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (!value || typeof value !== "object") continue;
        const index = Number(key);
        if (pathHead === "referenceMediaUrls" && Number.isInteger(index)) {
          const message =
            (value as { message?: unknown }).message;
          if (typeof message === "string") {
            items.referenceMediaUrls = {
              ...(items.referenceMediaUrls ?? {}),
              [index]: message,
            };
          }
        } else if (pathHead === "snsRecruits" && Number.isInteger(index)) {
          const sub = value as Record<string, { message?: unknown }>;
          const target: SnsRecruitItemError = {};
          for (const subKey of ["minFollowers", "recruitCount"] as const) {
            const message = sub[subKey]?.message;
            if (typeof message === "string") {
              target[subKey] = message;
            }
          }
          if (Object.keys(target).length > 0) {
            items.snsRecruits = {
              ...(items.snsRecruits ?? {}),
              [index]: target,
            };
          }
        }
      }
    };
    flatten(fieldErrors.referenceMediaUrls, "referenceMediaUrls");
    flatten(fieldErrors.snsRecruits, "snsRecruits");
    setPerItemErrors(items);
  }

  return (
    <FormProvider {...methods}>
      <form
        className="cf"
        onSubmit={methods.handleSubmit(submit, onInvalid)}
        noValidate
      >
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
              {...methods.register("title")}
              disabled={submitting}
            />
            {rootError("title") && (
              <div className="cf__error">{rootError("title")}</div>
            )}
          </div>

          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-reward">
              보수 금액
            </label>
            <Controller
              control={methods.control}
              name="rewardJpy"
              render={({ field }) => (
                <div className="cf__currency">
                  <span className="cf__currency-prefix">¥</span>
                  <input
                    id="cf-reward"
                    className="cf__input"
                    inputMode="numeric"
                    value={Number.isFinite(field.value) ? String(field.value) : ""}
                    onChange={(event) =>
                      field.onChange(parseIntegerInput(event.target.value))
                    }
                    onBlur={field.onBlur}
                    disabled={submitting}
                  />
                  <span className="cf__currency-suffix">円</span>
                </div>
              )}
            />
            {rootError("rewardJpy") && (
              <div className="cf__error">{rootError("rewardJpy")}</div>
            )}
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
                {...methods.register("recruitStartDate")}
                disabled={submitting}
              />
              {rootError("recruitStartDate") && (
                <div className="cf__error">{rootError("recruitStartDate")}</div>
              )}
            </div>
            <div className="cf__field">
              <label className="cf__label" htmlFor="cf-end">
                모집 종료일
              </label>
              <input
                id="cf-end"
                type="date"
                className="cf__input"
                {...methods.register("recruitEndDate")}
                disabled={submitting}
              />
              {rootError("recruitEndDate") && (
                <div className="cf__error">{rootError("recruitEndDate")}</div>
              )}
            </div>
          </div>

          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-posting-period">
              게시 기간 (수령 후 N일)
            </label>
            <Controller
              control={methods.control}
              name="postingPeriodDays"
              render={({ field }) => (
                <input
                  id="cf-posting-period"
                  className="cf__input"
                  inputMode="numeric"
                  placeholder="예시: 14"
                  value={
                    Number.isFinite(field.value) ? String(field.value) : ""
                  }
                  onChange={(event) =>
                    field.onChange(parseIntegerInput(event.target.value))
                  }
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            />
            {rootError("postingPeriodDays") && (
              <div className="cf__error">{rootError("postingPeriodDays")}</div>
            )}
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
              {thumbnailError && (
                <div className="cf__error">{thumbnailError}</div>
              )}
            </div>
            {rootError("thumbnailUrl") && (
              <div className="cf__error">{rootError("thumbnailUrl")}</div>
            )}
          </div>
        </section>

        <section className="cf__section">
          <h2 className="cf__section-title">SNS별 모집</h2>
          <p className="cf__sub-label">
            사용할 SNS를 선택하고, 각 SNS에 적용할 조건과 모집 인원을 입력하세요.
          </p>
          <Controller
            control={methods.control}
            name="snsRecruits"
            render={({ field }) => (
              <SnsRecruitList
                value={field.value}
                onChange={field.onChange}
                disabled={submitting}
                errorByIndex={perItemErrors.snsRecruits}
              />
            )}
          />
          {rootError("snsRecruits") && (
            <div className="cf__error">{rootError("snsRecruits")}</div>
          )}
        </section>

        <section className="cf__section">
          <h2 className="cf__section-title">상품</h2>

          <div className="cf__field">
            <label className="cf__label">상품 개요</label>
            <Controller
              control={methods.control}
              name="productSummary"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  minHeight={160}
                  imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
                />
              )}
            />
            {rootError("productSummary") && (
              <div className="cf__error">{rootError("productSummary")}</div>
            )}
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
              {...methods.register("productDetailUrl")}
              disabled={submitting}
            />
            {rootError("productDetailUrl") && (
              <div className="cf__error">{rootError("productDetailUrl")}</div>
            )}
          </div>
        </section>

        <section className="cf__section">
          <h2 className="cf__section-title">가이드라인</h2>

          <div className="cf__field">
            <label className="cf__label">안건 개요 (투고 가이드라인)</label>
            <Controller
              control={methods.control}
              name="guideline"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  minHeight={220}
                  imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
                />
              )}
            />
            {rootError("guideline") && (
              <div className="cf__error">{rootError("guideline")}</div>
            )}
          </div>

          <div className="cf__field">
            <label className="cf__label">투고 참고 영상/사진 URL</label>
            <Controller
              control={methods.control}
              name="referenceMediaUrls"
              render={({ field }) => (
                <ReferenceMediaUrlList
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  errorByIndex={perItemErrors.referenceMediaUrls}
                />
              )}
            />
            {rootError("referenceMediaUrls") && (
              <div className="cf__error">{rootError("referenceMediaUrls")}</div>
            )}
          </div>

          <div className="cf__field">
            <label className="cf__label">NG 및 주의 사항</label>
            <Controller
              control={methods.control}
              name="cautions"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  minHeight={200}
                  imageUploadEndpoint={CAMPAIGN_IMAGE_ENDPOINT}
                />
              )}
            />
            {rootError("cautions") && (
              <div className="cf__error">{rootError("cautions")}</div>
            )}
          </div>
        </section>

        <section className="cf__section">
          <h2 className="cf__section-title">참여 제외 캠페인</h2>
          <p className="cf__sub-label">
            여기서 선택한 캠페인에 이미 응모한 인플루언서는 이 캠페인에 응모할 수
            없습니다. (CANCELLED 상태인 응모는 제외)
          </p>
          <Controller
            control={methods.control}
            name="excludedCampaignIds"
            render={({ field }) => (
              <ExcludedCampaignsPicker
                allCampaigns={allCampaigns}
                selfId={selfCampaignId}
                value={field.value ?? []}
                onChange={field.onChange}
                disabled={submitting}
              />
            )}
          />
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
    </FormProvider>
  );
}
