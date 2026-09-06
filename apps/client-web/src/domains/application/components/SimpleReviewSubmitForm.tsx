import { useState } from "react";
import {
  useForm,
  FormProvider,
  useFieldArray,
  useFormState,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  CampaignSubTypeSchema,
  MAX_REVIEW_URLS,
  SUB_TYPE_LABEL,
  type AttachmentUploadInput,
  type CampaignSubType,
} from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import { useAttachmentUpload } from "../hooks/useAttachmentUpload";
import { PublishWindowNotice } from "./PublishWindowNotice";
import type { PublishWindowText } from "../publishWindowText";
import styles from "./ReviewSubmitForm.module.css";


const MIN_FILES = 1;
const MAX_FILES = 10;

const urlSchema = z
  .string()
  .regex(/^https:\/\/.+/i, t("application.simpleReviewForm.urlInvalid"));

const PLACEHOLDER_BY_SUB_TYPE: Partial<Record<CampaignSubType, string>> = {

  LIPS: "https://lipscosme.com/...",
  ATCOSME: "https://www.cosme.net/...",
};

/** 채널당 URL 배열. useFieldArray 가 객체 배열을 요구해 { value } 로 감싼다. */
type FormValues = {
  channels: { subType: CampaignSubType; urls: { value: string }[] }[];
};

interface Props {

  applicationId: string;
  subTypes: CampaignSubType[]; // 참여한 모든 리뷰 채널의 URL 을 한 폼에서 일괄 제출
  initial: Partial<Record<CampaignSubType, string[]>>;
  onSubmit: (
    reviews: { subType: CampaignSubType; urls: string[] }[],
    screenshots: AttachmentUploadInput[],
  ) => Promise<void>;
  submitting: boolean;
  reviewDeadlineAt: string | null;
  publishWindow: PublishWindowText;
}

/**
 * 채널 하나의 URL 입력 행들. 훅을 채널마다 호출해야 해서 컴포넌트로 분리한다.
 * 상품이 여러 개인 안건에서 리뷰 URL 을 필요한 만큼 추가할 수 있다.
 */
function ChannelUrlFields({
  channelIndex,
  subType,
  disabled,
}: {
  channelIndex: number;
  subType: CampaignSubType;
  disabled: boolean;
}) {
  const { fields, append, remove } = useFieldArray<FormValues>({
    name: `channels.${channelIndex}.urls`,
  });
  const { errors } = useFormState<FormValues>();
  // 중복 검사는 배열 전체에 걸리므로 개별 입력칸이 아니라 여기서 보여준다.
  const channelError = errors.channels?.[channelIndex]?.urls?.root?.message;

  return (
    <div className={styles.urlList}>
      {/* 라벨은 채널 단위 — 행 안에 두면 삭제 버튼이 입력칸 대신 라벨에 맞춰진다. */}
      <span className={styles.urlListLabel}>
        {SUB_TYPE_LABEL[subType]}{" "}
        {t("application.simpleReviewForm.labelSuffix")}
      </span>

      {fields.map((field, urlIndex) => (
        <div key={field.id} className={styles.urlRow}>
          <div className={styles.urlInput}>
            <FormField
              name={`channels.${channelIndex}.urls.${urlIndex}.value`}
            >
              {(field) => (
                <Input
                  id={field.id}
                  type="text"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={field.error}
                  disabled={disabled}
                  placeholder={PLACEHOLDER_BY_SUB_TYPE[subType] ?? "https://..."}
                  aria-label={`${SUB_TYPE_LABEL[subType]} ${t("application.simpleReviewForm.labelSuffix")} ${urlIndex + 1}`}
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>
          </div>

          {fields.length > 1 && (
            <button
              type="button"
              className={styles.urlRemove}
              onClick={() => remove(urlIndex)}
              disabled={disabled}
              aria-label={t("application.simpleReviewForm.removeUrlAriaLabel")}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {channelError && <div className={styles.error}>{channelError}</div>}

      <button
        type="button"
        className={styles.urlAdd}
        onClick={() => append({ value: "" })}
        disabled={disabled || fields.length >= MAX_REVIEW_URLS}
      >
        {t("application.simpleReviewForm.addUrl")}
      </button>
    </div>
  );
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

export function SimpleReviewSubmitForm({

  applicationId,
  subTypes,
  initial,
  onSubmit,
  submitting,
  reviewDeadlineAt,
  publishWindow,
}: Props) {
  const schema = z.object({
    channels: z.array(
      z.object({
        subType: CampaignSubTypeSchema,
        urls: z
          .array(z.object({ value: urlSchema }))
          .min(1)
          .refine(
            (rows) =>
              new Set(rows.map((row) => row.value)).size === rows.length,
            t("application.simpleReviewForm.urlDuplicate"),
          ),
      }),
    ),
  });
  const hasInitial = subTypes.some(
    (subType) => (initial[subType]?.length ?? 0) > 0,
  );
  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      channels: subTypes.map((subType) => ({
        subType,
        // 저장된 URL 이 없으면 빈 입력 한 줄로 시작한다.
        urls:
          initial[subType]?.length
            ? initial[subType]!.map((url) => ({ value: url }))
            : [{ value: "" }],
      })),
    },
  });
  const upload = useAttachmentUpload({

    applicationId,
    kind: "REVIEW_SCREENSHOT",
    maxFiles: MAX_FILES,
  });
  const [dragOver, setDragOver] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = submitting || upload.uploading;

  function openPicker() {

    if (busy || upload.remaining <= 0) return;
    upload.fileInputRef.current?.click();
  }

  async function handle(values: FormValues) {
    setSubmitError(null);
    const screenshots = upload.toInputs();
    if (screenshots.length < MIN_FILES) {
      setSubmitError(t("application.simpleReviewForm.screenshotsRequired"));
      return;
    }
    try {
      await onSubmit(
        values.channels.map((channel) => ({
          subType: channel.subType,
          urls: channel.urls.map((row) => row.value.trim()).filter(Boolean),
        })),
        screenshots,
      );
    } catch (err) {

      if (axios.isAxiosError(err)) {
        const message =
          (err.response?.data as { message?: string } | undefined)?.message;
        setSubmitError(message ?? err.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError(t("application.attachmentUpload.genericError"));
      }
    }
  }

  return (
    <FormProvider {...methods}>
      <form className={styles.form} onSubmit={methods.handleSubmit(handle)}>
        {subTypes.map((subType, channelIndex) => (
          <ChannelUrlFields
            key={subType}
            channelIndex={channelIndex}
            subType={subType}
            disabled={busy}
          />
        ))}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {subTypes
              .map((subType) => SUB_TYPE_LABEL[subType])
              .join(" · ")}{" "}
            {t("application.simpleReviewForm.screenshotsLabelSuffix")}
          </div>
          <div className={styles.sectionHint}>
            {t("application.attachmentUpload.hintPrefix")}
            {MAX_FILES}
            {t("application.attachmentUpload.hintSuffix")}
          </div>

          <div
            className={`${styles.dropzone} ${dragOver ? styles.dropzoneDrag : ""} ${
              busy || upload.remaining <= 0 ? styles.dropzoneDisabled : ""
            }`}
            onClick={openPicker}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy && upload.remaining > 0) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (!busy && upload.remaining > 0) {
                upload.handleFiles(event.dataTransfer.files);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicker();
              }
            }}
          >
            <i className={`${styles.dropzoneIcon} fa-regular fa-image`} />
            <div className={styles.dropzoneMain}>
              {upload.uploading
                ? t("application.attachmentUpload.uploading")
                : upload.remaining <= 0
                  ? t("application.attachmentUpload.limitReached")
                  : t("application.attachmentUpload.dropzoneMain")}
            </div>
            <div className={styles.dropzoneSub}>
              {upload.attachments.length}/{MAX_FILES}{" "}
              {t("application.attachmentUpload.unitSuffix")}
            </div>
            <input
              ref={upload.fileInputRef}
              className={styles.dropzoneHiddenInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={busy || upload.remaining <= 0}
              onChange={(event) => {
                upload.handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {upload.error && <div className={styles.error}>{upload.error}</div>}

          {(upload.attachments.length > 0 || upload.pendingCount > 0) && (
            <div className={styles.grid}>
              {upload.attachments.map((attachment, index) => (
                <div key={attachment.objectKey} className={styles.tile}>
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className={styles.tileImg}
                  />
                  <button
                    type="button"
                    className={styles.tileRemove}
                    onClick={() => upload.removeAttachment(index)}
                    disabled={busy}
                    aria-label={t("application.attachmentUpload.removeAriaLabel")}
                  >
                    ×
                  </button>
                </div>
              ))}
              {Array.from({ length: upload.pendingCount }).map((_, index) => (
                <div key={`pending-${index}`} className={styles.tile}>
                  <div className={styles.tileLoading}>
                    {t("application.attachmentUpload.uploading")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitError && <div className={styles.error}>{submitError}</div>}

        <PrimaryButton
          type="submit"
          disabled={busy || publishWindow.state === "BEFORE"}
        >
          {submitting
            ? t("application.simpleReviewForm.submitting")
            : upload.uploading
              ? t("application.attachmentUpload.uploading")
              : hasInitial
                ? t("application.simpleReviewForm.update")
                : t("application.simpleReviewForm.submit")}
        </PrimaryButton>
        <PublishWindowNotice publishWindow={publishWindow} />
        {reviewDeadlineAt && (
          <p
            style={{
              fontSize: 11,
              color: "#dc2626",
              marginTop: 4,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {t("application.simpleReviewForm.deadlineLabelPrefix")}
            {formatDeadline(reviewDeadlineAt)}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
