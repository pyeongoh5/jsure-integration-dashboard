import { useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  QOO10_REVIEW_CHANNEL_LABEL,
  type AttachmentUploadInput,
} from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import { useAttachmentUpload } from "../hooks/useAttachmentUpload";
import styles from "./ReviewSubmitForm.module.css";

const MIN_FILES = 2;
const MAX_FILES = 10;

type ReviewChannel = "LIPS" | "ATCOSME";
const REVIEW_CHANNELS: readonly ReviewChannel[] = ["LIPS", "ATCOSME"];

const urlSchema = z
  .string()
  .trim()
  .url(t("application.reviewForm.urlInvalid"))
  .refine((value) => /^https:\/\//i.test(value), {
    message: t("application.reviewForm.urlInvalid"),
  });

const schema = z.object({
  LIPS: urlSchema.optional().or(z.literal("")),
  ATCOSME: urlSchema.optional().or(z.literal("")),
});
type Values = z.infer<typeof schema>;

interface Props {
  applicationId: string;
  orderSubmittedAt: string;
  postingPeriodDays: number;
  subTypeOptions: readonly string[];
  onSubmit: (
    screenshots: AttachmentUploadInput[],
    reviewUrls: Partial<Record<ReviewChannel, string>>,
  ) => Promise<void>;
  submitting: boolean;
}

function computeRemainingDays(
  orderSubmittedAt: string,
  postingPeriodDays: number,
): number {
  const start = new Date(orderSubmittedAt);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + postingPeriodDays);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function ReviewSubmitForm({
  applicationId,
  orderSubmittedAt,
  postingPeriodDays,
  subTypeOptions,
  onSubmit,
  submitting,
}: Props) {
  const activeChannels = useMemo<ReviewChannel[]>(() => {
    const result: ReviewChannel[] = [];
    for (const channel of REVIEW_CHANNELS) {
      if (subTypeOptions.includes(channel)) result.push(channel);
    }
    return result;
  }, [subTypeOptions]);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { LIPS: "", ATCOSME: "" },
  });
  const upload = useAttachmentUpload({
    applicationId,
    kind: "REVIEW_SCREENSHOT",
    maxFiles: MAX_FILES,
  });
  const [dragOver, setDragOver] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = submitting || upload.uploading;
  const remainingDays = computeRemainingDays(orderSubmittedAt, postingPeriodDays);
  const deadlinePassed = remainingDays < 0;

  function openPicker() {
    if (busy || upload.remaining <= 0) return;
    upload.fileInputRef.current?.click();
  }

  async function handle(values: Values) {
    setSubmitError(null);
    const screenshots = upload.toInputs();
    if (screenshots.length < MIN_FILES) {
      setSubmitError(t("application.reviewForm.screenshotsRequired"));
      return;
    }
    const reviewUrls: Partial<Record<ReviewChannel, string>> = {};
    for (const channel of activeChannels) {
      const value = values[channel]?.trim();
      if (!value) {
        setSubmitError(t("application.reviewForm.channelUrlRequired"));
        return;
      }
      reviewUrls[channel] = value;
    }
    try {
      await onSubmit(screenshots, reviewUrls);
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
        <h2 className={styles.heading}>
          {t("application.stage.awaitingReview.heading")}
        </h2>
        <p className={styles.description}>
          {t("application.stage.awaitingReview.description")}
        </p>

        {deadlinePassed ? (
          <p className={styles.deadline}>
            {t("application.reviewForm.deadlinePassed")}
          </p>
        ) : (
          <p className={styles.deadlineOk}>
            {t("application.stage.awaitingReview.deadlineDaysPrefix")}
            {remainingDays}
            {t("application.stage.awaitingReview.deadlineDaysSuffix")}
          </p>
        )}

        {activeChannels.map((channel) => (
          <FormField
            key={channel}
            name={channel}
            label={`${QOO10_REVIEW_CHANNEL_LABEL[channel]} ${t("application.reviewForm.channelUrlLabelSuffix")}`}
          >
            {(field) => (
              <Input
                id={field.id}
                type="url"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("application.reviewForm.channelUrlPlaceholder")}
                error={field.error}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
        ))}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {t("application.stage.awaitingReview.screenshotsLabel")}
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

        <PrimaryButton type="submit" disabled={busy}>
          {submitting
            ? t("application.reviewForm.submitting")
            : upload.uploading
              ? t("application.attachmentUpload.uploading")
              : t("application.stage.awaitingReview.submit")}
        </PrimaryButton>
      </form>
    </FormProvider>
  );
}
