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
import { CampaignTagsInput } from "./CampaignTagsInput";
import { uploadCampaignThumbnail, UploadError } from "@/lib/uploads";
import { listCampaigns } from "../api";
import { RichTextEditor } from "@/components/composites/RichTextEditor/RichTextEditor";
import { Button } from "@/components/ui";
import { serializeRichTextHtml } from "@/lib/richTextImages";
import { useT } from "@/lib/i18n";
import styles from "./CampaignForm.module.css";

const CAMPAIGN_IMAGE_ENDPOINT = "/uploads/admin/campaign-image/presign";

export const EMPTY_CAMPAIGN_FORM: Values = {
  category: "SNS",
  title: "",
  tags: [],
  rewardType: "UNIFIED",
  rewardJpy: 0,
  recruitStartDate: "",
  recruitEndDate: "",
  postingPeriodDays: Number.NaN,
  publishStartDateTime: null,
  publishEndDateTime: null,
  orderPeriodDays: null,
  recruits: [],
  productSummary: "",
  productDetailUrls: [""],
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
  productDetailUrls?: Record<number, string>;
  recruits?: Record<number, RecruitItemError>;
}

type Props = {
  initialValue: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  /** 넘기면 "임시저장" 버튼이 노출된다. 폼 검증을 거치지 않고 입력 상태 그대로 저장한다. */
  onSaveDraft?: (values: Values) => Promise<void>;
  /** 캠페인 복사 진입용 — 원본 썸네일을 그대로 이어받는다(미리보기 URL + 저장 키). */
  initialThumbnail?: { objectKey: string; viewUrl: string };
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
  onSaveDraft,
  initialThumbnail,
  onCancel,
  selfCampaignId,
}: Props) {
  const t = useT();
  const methods = useForm<Values>({
    resolver: zodResolver(CampaignFormSchema) as unknown as Resolver<Values>,
    defaultValues: initialValue,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const [allCampaigns, setAllCampaigns] = useState<CampaignResponse[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailDraft, setThumbnailDraft] = useState<ThumbnailDraft>(
    initialThumbnail
      ? { kind: "new", ...initialThumbnail }
      : { kind: "unchanged" },
  );
  const [perItemErrors, setPerItemErrors] = useState<PerItemErrors>({});
  const [bulkRewardJpy, setBulkRewardJpy] = useState<number>(Number.NaN);
  const [savingDraft, setSavingDraft] = useState(false);

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
          : t("domains.campaign.form.uploadFailed"),
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
  // 임시저장 버튼 활성 조건 — 제목 1자 이상.
  const draftTitle = methods.watch("title");
  const fieldErrors = methods.formState.errors;

  function rootError(name: keyof Values): string | undefined {
    const issue = fieldErrors[name];
    if (!issue) return undefined;
    return typeof issue.message === "string" ? issue.message : undefined;
  }

  /**
   * 본문 이미지 직렬화 + 썸네일 반영. 썸네일을 건드리지 않았으면 필드를 지워
   * 서버가 기존 값을 유지하게 한다.
   */
  function withMediaFields(values: Values): Values {
    const next: Values = {
      ...values,
      productSummary: serializeRichTextHtml(values.productSummary),
      guideline: serializeRichTextHtml(values.guideline),
      cautions: serializeRichTextHtml(values.cautions),
    };
    if (thumbnailDraft.kind === "new") {
      next.thumbnailUrl = thumbnailDraft.objectKey;
    } else if (thumbnailDraft.kind === "removed") {
      next.thumbnailUrl = null;
    } else {
      delete next.thumbnailUrl;
    }
    return next;
  }

  /** 임시저장 — 검증 없이 현재 입력을 그대로 보낸다(제목만 필수). */
  async function saveDraft() {
    if (!onSaveDraft || savingDraft) return;
    setBanner(null);
    setSavingDraft(true);
    try {
      await onSaveDraft(withMediaFields(methods.getValues()));
    } catch (err) {
      setBanner(err instanceof Error ? err.message : t("domains.campaign.form.draftSaveFailed"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit(values: Values) {
    setBanner(null);
    // RHF가 검증을 통과시킨 시점이므로 perItemErrors도 초기화
    setPerItemErrors({});

    // 업로드가 끝나지 않은 이미지 (data-r2-key 없는 img) 차단
    const pending = [values.productSummary, values.guideline, values.cautions];
    if (pending.some((html) => /<img\b(?![^>]*\bdata-r2-key=)[^>]*>/.test(html))) {
      setBanner(t("domains.campaign.form.imagesUploading"));
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
            isRequired: true, // 단순 리뷰는 선택한 서브타입이 곧 필수 응모
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
        // 주문 마감은 가구매 전용 — 카테고리를 바꿔도 값이 남지 않게 한다.
        orderPeriodDays:
          values.category === "FAKE_PURCHASE" ? (values.orderPeriodDays ?? null) : null,
        // 개별 보수 캠페인에서는 통합 보수 금액을 사용하지 않는다.
        rewardJpy: values.rewardType === "PER_SUBTYPE" ? 0 : values.rewardJpy,
        recruits: normalizedRecruits,
      };
      await onSubmit(withMediaFields(finalValues));
    } catch (err) {
      setBanner(err instanceof Error ? err.message : t("domains.campaign.form.saveError"));
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
        if (
          (pathHead === "referenceMediaUrls" || pathHead === "productDetailUrls") &&
          Number.isInteger(index)
        ) {
          const message = (value as { message?: unknown }).message;
          if (typeof message === "string") {
            items[pathHead] = {
              ...(items[pathHead] ?? {}),
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
    flatten(fieldErrors.productDetailUrls, "productDetailUrls");
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
          <h2 className={styles.sectionTitle}>{t("domains.campaign.form.sectionBasic")}</h2>

          <div className={styles.field}>
            <label className={styles.label}>
              {t("domains.application.applicants.categoryFilter.prefix")}
            </label>
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
                        {t("domains.application.category.fakePurchase")}
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
                        {t("domains.application.category.simpleReview")}
                      </label>
                    </div>
                    {isEditMode && (
                      <p className={styles.hint}>{t("domains.campaign.form.categoryLockedHint")}</p>
                    )}
                  </>
                );
              }}
            />
            {rootError("category") && <div className={styles.error}>{rootError("category")}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-title">
              {t("domains.campaign.form.titleLabel")}
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
            <label className={styles.label}>
              {t("domains.campaign.form.tagsLabel")}
            </label>
            <Controller
              control={methods.control}
              name="tags"
              render={({ field }) => (
                <CampaignTagsInput
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                />
              )}
            />
            {rootError("tags") && (
              <div className={styles.error}>{rootError("tags")}</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t("domains.campaign.form.rewardTypeLabel")}</label>
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
                    {t("domains.campaign.form.rewardUnified")}
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
                    {t("domains.campaign.form.rewardPerSubType")}
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
                {t("domains.campaign.form.rewardAmountLabel")}
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
                {t("domains.campaign.form.recruitStartLabel")}
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
                {t("domains.campaign.form.recruitEndLabel")}
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
              {t("domains.campaign.form.postingPeriodLabel")}
            </label>
            <Controller
              control={methods.control}
              name="postingPeriodDays"
              render={({ field }) => (
                <input
                  id="cf-posting-period"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={t("domains.campaign.form.postingPeriodPlaceholder")}
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

          {methods.watch("category") === "FAKE_PURCHASE" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-order-period">
                {t("domains.campaign.form.orderPeriodLabel")}
              </label>
              <Controller
                control={methods.control}
                name="orderPeriodDays"
                render={({ field }) => (
                  <input
                    id="cf-order-period"
                    className={styles.input}
                    inputMode="numeric"
                    placeholder={t("domains.campaign.form.orderPeriodPlaceholder")}
                    value={field.value == null ? "" : String(field.value)}
                    onChange={(event) => {
                      const parsed = parseIntegerInput(event.target.value);
                      field.onChange(Number.isFinite(parsed) ? parsed : null);
                    }}
                    onBlur={field.onBlur}
                    disabled={submitting}
                  />
                )}
              />
              <div className={styles.hint}>{t("domains.campaign.form.orderPeriodHint")}</div>
              {rootError("orderPeriodDays") && (
                <div className={styles.error}>{rootError("orderPeriodDays")}</div>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cf-thumbnail">
              {t("domains.campaign.form.thumbnailLabel")}
            </label>
            <div className={styles.thumbnail}>
              {thumbnailPreviewSrc && (
                <div className={styles.thumbnailPreview}>
                  <img src={thumbnailPreviewSrc} alt={t("domains.campaign.form.thumbnailAlt")} />
                  <button
                    type="button"
                    className={styles.thumbnailRemove}
                    onClick={removeThumbnail}
                    disabled={submitting || uploadingThumbnail}
                  >
                    {t("domains.campaign.form.removeThumbnail")}
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
              <p className={styles.hint}>{t("domains.campaign.form.thumbnailHint")}</p>
              {uploadingThumbnail && (
                <div className={styles.hint}>{t("domains.campaign.form.uploading")}</div>
              )}
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
              ? t("domains.campaign.form.sectionRecruitsFake")
              : methods.watch("category") === "SIMPLE_REVIEW"
                ? t("domains.campaign.form.sectionRecruitsSimpleReview")
                : t("domains.campaign.form.sectionRecruitsSns")}
          </h2>
          <p className={styles.subLabel}>
            {methods.watch("category") === "FAKE_PURCHASE"
              ? t("domains.campaign.form.recruitsHintFake")
              : methods.watch("category") === "SIMPLE_REVIEW"
                ? t("domains.campaign.form.recruitsHintSimpleReview")
                : t("domains.campaign.form.recruitsHintSns")}
          </p>
          {methods.watch("rewardType") === "PER_SUBTYPE" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-bulk-reward">
                {t("domains.campaign.form.bulkRewardLabel")}
              </label>
              <div className={styles.currency}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span className={styles.currencyPrefix}>¥</span>
                  <input
                    id="cf-bulk-reward"
                    className={styles.input}
                    inputMode="numeric"
                    placeholder={t("domains.campaign.form.bulkRewardPlaceholder")}
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
                  {t("domains.campaign.form.bulkRewardApply")}
                </Button>
              </div>
              <p className={styles.hint}>{t("domains.campaign.form.bulkRewardHint")}</p>
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
          <h2 className={styles.sectionTitle}>{t("domains.campaign.form.sectionProduct")}</h2>

          <div className={styles.field}>
            <label className={styles.label}>{t("domains.campaign.form.productSummaryLabel")}</label>
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
            <label className={styles.label}>
              {t("domains.campaign.form.productDetailUrlLabel")}
            </label>
            <Controller
              control={methods.control}
              name="productDetailUrls"
              render={({ field }) => (
                <ReferenceMediaUrlList
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  placeholder="https://www.qoo10.jp/..."
                  errorByIndex={perItemErrors.productDetailUrls}
                />
              )}
            />
            {rootError("productDetailUrls") && (
              <div className={styles.error}>{rootError("productDetailUrls")}</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("domains.campaign.form.sectionGuideline")}</h2>

          <div className={styles.field}>
            <label className={styles.label}>{t("domains.campaign.form.guidelineLabel")}</label>
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
            <label className={styles.label}>
              {t("domains.campaign.form.referenceMediaLabel")}
            </label>
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
            <label className={styles.label}>{t("domains.campaign.form.cautionsLabel")}</label>
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
          <h2 className={styles.sectionTitle}>{t("domains.campaign.form.sectionExcluded")}</h2>
          <p className={styles.subLabel}>{t("domains.campaign.form.excludedHint")}</p>
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
            {t("common.cancel")}
          </Button>
          {onSaveDraft && (
            <Button
              variant="ghost"
              size="md"
              onClick={saveDraft}
              disabled={submitting || savingDraft || draftTitle.trim() === ""}
              loading={savingDraft}
            >
              {savingDraft
                ? t("domains.campaign.form.saving")
                : t("domains.campaign.form.saveDraft")}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? t("domains.campaign.form.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
