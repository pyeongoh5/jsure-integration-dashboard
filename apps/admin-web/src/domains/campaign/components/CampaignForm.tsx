import { useEffect, useRef, useState } from "react";
import { useForm, FormProvider, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CampaignFormSchema,
  type CampaignForm as Values,
  type CampaignResponse,
} from "@jsure/shared";
import { RecruitList } from "./RecruitList";
import { ReferenceMediaUrlList } from "./ReferenceMediaUrlList";
import { ExcludedCampaignsPicker } from "./ExcludedCampaignsPicker";
import { uploadCampaignThumbnail, UploadError } from "@/lib/uploads";
import { listCampaigns } from "../api";
import { RichTextEditor } from "@/components/composites/RichTextEditor/RichTextEditor";
import { Button } from "@/components/ui";
import { serializeRichTextHtml } from "@/lib/richTextImages";
import styles from "./CampaignForm.module.css";

const CAMPAIGN_IMAGE_ENDPOINT = "/uploads/admin/campaign-image/presign";

export const EMPTY_CAMPAIGN_FORM: Values = {
  category: "SNS",
  title: "",
  rewardType: "UNIFIED",
  rewardJpy: 0,
  recruitStartDate: "",
  recruitEndDate: "",
  postingPeriodDays: Number.NaN,
  recruits: [],
  productSummary: "",
  productDetailUrl: "",
  guideline: "",
  referenceMediaUrls: [],
  cautions: "",
  thumbnailUrl: null,
  excludedCampaignIds: [],
};

type RecruitItemError = Partial<
  Record<
    | "minFollowers"
    | "recruitCount"
    | "rewardJpy"
    | "subTypeOptions"
    | "options"
    | "productPriceJpy"
    | "productUrl",
    string
  >
>;

interface PerItemErrors {
  referenceMediaUrls?: Record<number, string>;
  recruits?: Record<number, RecruitItemError>;
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
  const formRef = useRef<HTMLFormElement>(null);
  const [allCampaigns, setAllCampaigns] = useState<CampaignResponse[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailDraft, setThumbnailDraft] = useState<ThumbnailDraft>({
    kind: "unchanged",
  });
  const [perItemErrors, setPerItemErrors] = useState<PerItemErrors>({});
  const [bulkRewardJpy, setBulkRewardJpy] = useState<number>(Number.NaN);

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
        uploadError instanceof UploadError ? uploadError.message : "업로드에 실패했습니다",
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
    if (pending.some((html) => /<img\b(?![^>]*\bdata-r2-key=)[^>]*>/.test(html))) {
      setBanner("이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    try {
      // 옵션별 세부 설정은 옵션 선택형(INSTAGRAM)에서만, UNIFIED 면 옵션 보수 제거.
      const normalizeRecruitOptions = (
        recruit: Values["recruits"][number],
      ): Values["recruits"][number]["options"] => {
        if (recruit.subType !== "INSTAGRAM") return [];
        const options =
          values.rewardType === "PER_SUBTYPE"
            ? recruit.options
            : recruit.options.map((option) => ({ ...option, rewardJpy: null }));
        const meaningless = options.every(
          (option) => option.recruitCount === null && option.rewardJpy === null,
        );
        return meaningless ? [] : options;
      };
      const normalizedRecruits = values.recruits.map((recruit) => {
        const options = normalizeRecruitOptions(recruit);
        // 옵션별 보수 분리 시 서브타입 보수는 null 강제.
        const rewardSplit =
          options.length > 0 &&
          options.every((option) => option.rewardJpy !== null);
        const rewardJpy =
          values.rewardType === "PER_SUBTYPE" && !rewardSplit
            ? recruit.rewardJpy
            : null;
        if (values.category === "SNS") {
          return {
            ...recruit,
            rewardJpy,
            options,
            productPriceJpy: null,
            productUrl: null,
          };
        }
        if (values.category === "SIMPLE_REVIEW") {
          return {
            ...recruit,
            rewardJpy,
            options: [],
            productPriceJpy: null,
            productUrl: null,
            insightRequired: false,
            subTypeOptions: [],
          };
        }
        return {
          ...recruit,
          rewardJpy,
          options: [],
          minFollowers: 0,
          insightRequired: false,
        };
      });
      const finalValues: Values = {
        ...values,
        // 개별 보수 캠페인에서는 통합 보수 금액을 사용하지 않는다.
        rewardJpy: values.rewardType === "PER_SUBTYPE" ? 0 : values.rewardJpy,
        recruits: normalizedRecruits,
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
      setBanner(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  }

  function onInvalid() {
    // zod 의 array index 에러를 RHF formState 가 아닌 별도 state 에 풀어서 보존
    const items: PerItemErrors = {};
    const flatten = (node: unknown, pathHead: string): void => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (!value || typeof value !== "object") continue;
        const index = Number(key);
        if (pathHead === "referenceMediaUrls" && Number.isInteger(index)) {
          const message = (value as { message?: unknown }).message;
          if (typeof message === "string") {
            items.referenceMediaUrls = {
              ...(items.referenceMediaUrls ?? {}),
              [index]: message,
            };
          }
        } else if (pathHead === "recruits" && Number.isInteger(index)) {
          const sub = value as Record<string, { message?: unknown }>;
          const target: RecruitItemError = {};
          for (const subKey of [
            "minFollowers",
            "recruitCount",
            "rewardJpy",
            "subTypeOptions",
            "options",
            "productPriceJpy",
            "productUrl",
          ] as const) {
            const message = sub[subKey]?.message;
            if (typeof message === "string") {
              target[subKey] = message;
            }
          }
          if (Object.keys(target).length > 0) {
            items.recruits = {
              ...(items.recruits ?? {}),
              [index]: target,
            };
          }
        }
      }
    };
    flatten(fieldErrors.referenceMediaUrls, "referenceMediaUrls");
    flatten(fieldErrors.recruits, "recruits");
    setPerItemErrors(items);

    // render 후 첫 에러 element 로 스크롤 + 포커스
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      const target =
        form.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        form.querySelector<HTMLElement>(`.${styles.error}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof (target as HTMLElement & { focus?: () => void }).focus === "function") {
        target.focus({ preventScroll: true });
      }
    });
  }

  return (
    <FormProvider {...methods}>
      <form
        ref={formRef}
        className={styles.root}
        onSubmit={methods.handleSubmit(submit, onInvalid)}
        noValidate
      >
        {banner && <div className={styles.banner}>{banner}</div>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>기본 정보</h2>

          <div className={styles.field}>
            <label className={styles.label}>카테고리</label>
            <Controller
              control={methods.control}
              name="category"
              render={({ field }) => {
                const isEditMode = Boolean(selfCampaignId);
                return (
                  <>
                    <div className={styles.radioGroup}>
                      <label className={styles.radioOption}>
                        <input
                          type="radio"
                          name="cf-category"
                          value="SNS"
                          checked={field.value === "SNS"}
                          disabled={isEditMode || submitting}
                          onChange={() => {
                            field.onChange("SNS");
                            methods.setValue("recruits", [], {
                              shouldValidate: false,
                              shouldDirty: true,
                            });
                          }}
                        />
                        SNS
                      </label>
                      <label className={styles.radioOption}>
                        <input
                          type="radio"
                          name="cf-category"
                          value="FAKE_PURCHASE"
                          checked={field.value === "FAKE_PURCHASE"}
                          disabled={isEditMode || submitting}
                          onChange={() => {
                            field.onChange("FAKE_PURCHASE");
                            methods.setValue("recruits", [], {
                              shouldValidate: false,
                              shouldDirty: true,
                            });
                          }}
                        />
                        가구매
                      </label>
                      <label className={styles.radioOption}>
                        <input
                          type="radio"
                          name="cf-category"
                          value="SIMPLE_REVIEW"
                          checked={field.value === "SIMPLE_REVIEW"}
                          disabled={isEditMode || submitting}
                          onChange={() => {
                            field.onChange("SIMPLE_REVIEW");
                            methods.setValue("recruits", [], {
                              shouldValidate: false,
                              shouldDirty: true,
                            });
                          }}
                        />
                        단순 리뷰
                      </label>
                    </div>
                    {isEditMode && (
                      <p className={styles.hint}>카테고리는 생성 후 변경할 수 없습니다.</p>
                    )}
                  </>
                );
              }}
            />
            {rootError("category") && <div className={styles.error}>{rootError("category")}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-title">
              캠페인 제목
            </label>
            <input
              id="cf-title"
              className={styles.input}
              {...methods.register("title")}
              disabled={submitting}
            />
            {rootError("title") && <div className={styles.error}>{rootError("title")}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>보수 체계</label>
            <Controller
              control={methods.control}
              name="rewardType"
              render={({ field }) => (
                <div className={styles.radioGroup}>
                  <label className={styles.radioOption}>
                    <input
                      type="radio"
                      name="cf-reward-type"
                      value="UNIFIED"
                      checked={field.value === "UNIFIED"}
                      disabled={submitting}
                      onChange={() => {
                        field.onChange("UNIFIED");
                        // 통합 보수에서는 서브타입별/옵션별 보수를 사용하지 않는다.
                        methods.setValue(
                          "recruits",
                          methods.getValues("recruits").map((recruit) => {
                            const options = recruit.options.map((option) => ({
                              ...option,
                              rewardJpy: null,
                            }));
                            return {
                              ...recruit,
                              rewardJpy: null,
                              options: options.some(
                                (option) => option.recruitCount !== null,
                              )
                                ? options
                                : [],
                            };
                          }),
                          { shouldValidate: false, shouldDirty: true },
                        );
                      }}
                    />
                    통합 보수 (참여 SNS 수와 무관하게 고정)
                  </label>
                  <label className={styles.radioOption}>
                    <input
                      type="radio"
                      name="cf-reward-type"
                      value="PER_SUBTYPE"
                      checked={field.value === "PER_SUBTYPE"}
                      disabled={submitting}
                      onChange={() => {
                        field.onChange("PER_SUBTYPE");
                        // 통합 보수 금액 필드가 숨겨지므로 검증 통과값으로 정리.
                        methods.setValue("rewardJpy", 0, {
                          shouldValidate: false,
                          shouldDirty: true,
                        });
                      }}
                    />
                    개별 보수 (참여 서브타입별 금액 합산)
                  </label>
                </div>
              )}
            />
            {rootError("rewardType") && (
              <div className={styles.error}>{rootError("rewardType")}</div>
            )}
          </div>

          {methods.watch("rewardType") === "UNIFIED" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-reward">
                보수 금액
              </label>
              <Controller
                control={methods.control}
                name="rewardJpy"
                render={({ field }) => (
                  <div className={styles.currency}>
                    <span className={styles.currencyPrefix}>¥</span>
                    <input
                      id="cf-reward"
                      className={styles.input}
                      inputMode="numeric"
                      value={Number.isFinite(field.value) ? String(field.value) : ""}
                      onChange={(event) => field.onChange(parseIntegerInput(event.target.value))}
                      onBlur={field.onBlur}
                      disabled={submitting}
                    />
                    <span className={styles.currencySuffix}>円</span>
                  </div>
                )}
              />
              {rootError("rewardJpy") && (
                <div className={styles.error}>{rootError("rewardJpy")}</div>
              )}
            </div>
          )}

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-start">
                모집 시작일
              </label>
              <input
                id="cf-start"
                type="date"
                className={styles.input}
                {...methods.register("recruitStartDate")}
                disabled={submitting}
              />
              {rootError("recruitStartDate") && (
                <div className={styles.error}>{rootError("recruitStartDate")}</div>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-end">
                모집 종료일
              </label>
              <input
                id="cf-end"
                type="date"
                className={styles.input}
                {...methods.register("recruitEndDate")}
                disabled={submitting}
              />
              {rootError("recruitEndDate") && (
                <div className={styles.error}>{rootError("recruitEndDate")}</div>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-posting-period">
              게시 기간 (수령 후 N일)
            </label>
            <Controller
              control={methods.control}
              name="postingPeriodDays"
              render={({ field }) => (
                <input
                  id="cf-posting-period"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder="예시: 14"
                  value={Number.isFinite(field.value) ? String(field.value) : ""}
                  onChange={(event) => field.onChange(parseIntegerInput(event.target.value))}
                  onBlur={field.onBlur}
                  disabled={submitting}
                />
              )}
            />
            {rootError("postingPeriodDays") && (
              <div className={styles.error}>{rootError("postingPeriodDays")}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-thumbnail">
              썸네일 이미지 (인플루언서 앱 표시용)
            </label>
            <div className={styles.thumbnail}>
              {thumbnailPreviewSrc && (
                <div className={styles.thumbnailPreview}>
                  <img src={thumbnailPreviewSrc} alt="썸네일" />
                  <button
                    type="button"
                    className={styles.thumbnailRemove}
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
                className={styles.file}
                disabled={submitting || uploadingThumbnail}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  void handleThumbnailFile(file);
                }}
              />
              <p className={styles.hint}>PNG · JPEG · WebP, 5MB 이하</p>
              {uploadingThumbnail && <div className={styles.hint}>업로드 중...</div>}
              {thumbnailError && <div className={styles.error}>{thumbnailError}</div>}
            </div>
            {rootError("thumbnailUrl") && (
              <div className={styles.error}>{rootError("thumbnailUrl")}</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {methods.watch("category") === "FAKE_PURCHASE"
              ? "가구매 채널별 모집"
              : methods.watch("category") === "SIMPLE_REVIEW"
                ? "단순 리뷰 채널별 모집"
                : "SNS별 모집"}
          </h2>
          <p className={styles.subLabel}>
            {methods.watch("category") === "FAKE_PURCHASE"
              ? "가구매를 진행할 채널을 선택하고, 채널별 모집 인원과 상품 정보를 입력하세요."
              : methods.watch("category") === "SIMPLE_REVIEW"
                ? "리뷰를 받을 채널(LIPS/@cosme)을 선택하고, 채널별 모집 인원과 최소 팔로워 조건을 입력하세요."
                : "사용할 SNS를 선택하고, 각 SNS에 적용할 조건과 모집 인원을 입력하세요."}
          </p>
          {methods.watch("rewardType") === "PER_SUBTYPE" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-bulk-reward">
                보수 일괄 입력
              </label>
              <div className={styles.currency}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span className={styles.currencyPrefix}>¥</span>
                  <input
                    id="cf-bulk-reward"
                    className={styles.input}
                    inputMode="numeric"
                    placeholder="모든 서브타입에 적용할 금액"
                    value={Number.isFinite(bulkRewardJpy) ? String(bulkRewardJpy) : ""}
                    onChange={(event) => setBulkRewardJpy(parseIntegerInput(event.target.value))}
                    disabled={submitting}
                  />
                  <span className={styles.currencySuffix}>円</span>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={submitting || !Number.isFinite(bulkRewardJpy)}
                  onClick={() => {
                    methods.setValue(
                      "recruits",
                      methods.getValues("recruits").map((recruit) => {
                        // 옵션별 보수 분리 중인 recruit 는 일괄 적용 대상에서 제외.
                        const rewardSplit =
                          recruit.options.length > 0 &&
                          recruit.options.every(
                            (option) => option.rewardJpy !== null,
                          );
                        return rewardSplit
                          ? recruit
                          : { ...recruit, rewardJpy: bulkRewardJpy };
                      }),
                      { shouldValidate: false, shouldDirty: true },
                    );
                  }}
                >
                  일괄 적용
                </Button>
              </div>
              <p className={styles.hint}>
                선택된 모든 서브타입의 보수 금액을 같은 값으로 채웁니다.
              </p>
            </div>
          )}
          <Controller
            control={methods.control}
            name="recruits"
            render={({ field }) => (
              <RecruitList
                category={methods.watch("category")}
                rewardType={methods.watch("rewardType")}
                value={field.value}
                onChange={field.onChange}
                disabled={submitting}
                errorByIndex={perItemErrors.recruits}
              />
            )}
          />
          {rootError("recruits") && <div className={styles.error}>{rootError("recruits")}</div>}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>상품</h2>

          <div className={styles.field}>
            <label className={styles.label}>상품 개요</label>
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
              <div className={styles.error}>{rootError("productSummary")}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-product-url">
              상품 상세 URL (qoo10)
            </label>
            <input
              id="cf-product-url"
              type="url"
              className={styles.input}
              placeholder="https://www.qoo10.jp/..."
              {...methods.register("productDetailUrl")}
              disabled={submitting}
            />
            {rootError("productDetailUrl") && (
              <div className={styles.error}>{rootError("productDetailUrl")}</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>가이드라인</h2>

          <div className={styles.field}>
            <label className={styles.label}>안건 개요 (투고 가이드라인)</label>
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
            {rootError("guideline") && <div className={styles.error}>{rootError("guideline")}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>투고 참고 영상/사진 URL</label>
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
              <div className={styles.error}>{rootError("referenceMediaUrls")}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>주의 사항</label>
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
            {rootError("cautions") && <div className={styles.error}>{rootError("cautions")}</div>}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>참여 제외 캠페인</h2>
          <p className={styles.subLabel}>
            여기서 선택한 캠페인에 이미 응모한 인플루언서는 이 캠페인에 응모할 수 없습니다.
            (CANCELLED 상태인 응모는 제외)
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

        <div className={styles.actions}>
          <Button variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? "저장 중…" : submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
