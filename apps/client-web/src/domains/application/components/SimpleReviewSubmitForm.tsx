import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  SUB_TYPE_LABEL,
  type AttachmentUploadInput,
  type CampaignSubType,
} from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import { useAttachmentUpload } from "../hooks/useAttachmentUpload";
import styles from "./ReviewSubmitForm.module.css";


const MIN_FILES = 1;
const MAX_FILES = 10;

const schema = z.object({
  url: z.string().regex(/^https:\/\/.+/i, t("application.simpleReviewForm.urlInvalid")),
});
type Values = z.infer<typeof schema>;

const PLACEHOLDER_BY_SUB_TYPE: Partial<Record<CampaignSubType, string>> = {

  LIPS: "https://lipscosme.com/...",
  ATCOSME: "https://www.cosme.net/...",
};

interface Props {

  applicationId: string;
  subType: CampaignSubType;
  initial: string;
  onSubmit: (
    url: string,
    screenshots: AttachmentUploadInput[],
  ) => Promise<void>;
  submitting: boolean;
  reviewDeadlineAt: string | null;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

export function SimpleReviewSubmitForm({

  applicationId,
  subType,
  initial,
  onSubmit,
  submitting,
  reviewDeadlineAt,
}: Props) {
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { url: initial },
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

  async function handle(values: Values) {
    setSubmitError(null);
    const screenshots = upload.toInputs();
    if (screenshots.length < MIN_FILES) {
      setSubmitError(t("application.reviewForm.screenshotsRequired"));
      return;
    }
    try {
      await onSubmit(values.url, screenshots);
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
        <FormField
          name="url"
          label={`${SUB_TYPE_LABEL[subType]} ${t("application.simpleReviewForm.labelSuffix")}`}
        >
          {(field) => (
            <Input
              id={field.id}
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder={PLACEHOLDER_BY_SUB_TYPE[subType] ?? "https://..."}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {`${SUB_TYPE_LABEL[subType]} ${t("application.simpleReviewForm.screenshotsLabelSuffix")}`}
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
            ? t("application.simpleReviewForm.submitting")
            : upload.uploading
              ? t("application.attachmentUpload.uploading")
              : initial
                ? t("application.simpleReviewForm.update")
                : t("application.simpleReviewForm.submit")}
        </PrimaryButton>
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
