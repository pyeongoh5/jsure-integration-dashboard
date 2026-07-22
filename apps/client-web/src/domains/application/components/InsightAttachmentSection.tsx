import { useRef, useState } from "react";
import type { CampaignSubType } from "@jsure/shared";
import { t } from "@i18n";
import { presignInsightUpload } from "../api";
import styles from "./InsightSubmitForm.module.css";

export type InsightImageContentType = "image/png" | "image/jpeg" | "image/webp";

const ALLOWED: InsightImageContentType[] = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

export interface InsightAttachment {
  objectKey: string;
  contentType: InsightImageContentType;
  sizeBytes: number;
  previewUrl: string;
  name: string;
}

interface Props {
  applicationId: string;
  subType: CampaignSubType;
  attachments: InsightAttachment[];
  onChange: (next: InsightAttachment[]) => void;
  disabled: boolean;
}

/** 서브타입 1개의 인사이트 스크린샷 업로더. */
export function InsightAttachmentSection({
  applicationId,
  subType,
  attachments,
  onChange,
  disabled,
}: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = pendingCount > 0;
  const busy = disabled || uploading;
  const remaining = MAX_FILES - attachments.length;

  async function uploadOne(file: File): Promise<InsightAttachment | null> {
    if (!ALLOWED.includes(file.type as InsightImageContentType)) {
      setUploadError(`${t("application.insightForm.unsupportedFilePrefix")}${file.name}`);
      return null;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`${t("application.insightForm.oversizedFilePrefix")}${file.name}`);
      return null;
    }
    const contentType = file.type as InsightImageContentType;
    const presign = await presignInsightUpload({
      applicationId,
      subType,
      contentType,
      sizeBytes: file.size,
    });
    const put = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!put.ok) {
      setUploadError(`${t("application.insightForm.uploadFailedPrefix")}${file.name}`);
      return null;
    }
    return {
      objectKey: presign.objectKey,
      contentType,
      sizeBytes: file.size,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    };
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    if (remaining <= 0) {
      setUploadError(
        `${t("application.insightForm.maxFilesPrefix")}${MAX_FILES}${t("application.insightForm.maxFilesSuffix")}`,
      );
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setPendingCount((count) => count + list.length);
    let current = attachments;
    try {
      for (const file of list) {
        try {
          const attachment = await uploadOne(file);
          if (attachment) {
            current = [...current, attachment];
            onChange(current);
          }
        } finally {
          setPendingCount((count) => count - 1);
        }
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : t("application.insightForm.uploadGenericError"),
      );
    }
  }

  function removeAttachment(index: number) {
    const target = attachments[index];
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(attachments.filter((_, i) => i !== index));
  }

  function openPicker() {
    if (busy || remaining <= 0) return;
    fileInputRef.current?.click();
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t("application.insightForm.screenshotTitle")}</div>
      <div className={styles.sectionHint}>
        {t("application.insightForm.screenshotHintPrefix")}
        {MAX_FILES}
        {t("application.insightForm.screenshotHintSuffix")}
      </div>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneDrag : ""} ${
          busy || remaining <= 0 ? styles.dropzoneDisabled : ""
        }`}
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && remaining > 0) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (!busy && remaining > 0) handleFiles(event.dataTransfer.files);
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
          {uploading
            ? t("application.insightForm.uploading")
            : remaining <= 0
              ? t("application.insightForm.limitReached")
              : t("application.insightForm.dropzoneMain")}
        </div>
        <div className={styles.dropzoneSub}>
          {attachments.length}/{MAX_FILES} {t("application.insightForm.unitSuffix")}
        </div>
        <input
          ref={fileInputRef}
          className={styles.dropzoneHiddenInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={busy || remaining <= 0}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploadError && <div className={styles.error}>{uploadError}</div>}

      {(attachments.length > 0 || pendingCount > 0) && (
        <div className={styles.grid}>
          {attachments.map((attachment, index) => (
            <div key={attachment.objectKey} className={styles.tile}>
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className={styles.tileImg}
              />
              <button
                type="button"
                className={styles.tileRemove}
                onClick={() => removeAttachment(index)}
                disabled={busy}
                aria-label={t("application.insightForm.removeAriaLabel")}
              >
                ×
              </button>
            </div>
          ))}
          {Array.from({ length: pendingCount }).map((_, index) => (
            <div key={`pending-${index}`} className={styles.tile}>
              <div className={styles.tileLoading}>{t("application.insightForm.uploading")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
