import { useState } from "react";
import {
  ADMIN_INSIGHT_METRIC_KEYS,
  SUB_TYPE_LABEL,
  type AdminInsightMetricKey,
  type AdminSubmission,
  type AdminUpdateInsightRequest,
  type Attachment,
  type InsightAttachmentInput,
} from "@jsure/shared";
import { translate, type AdminTranslationKey } from "@i18n/admin";
import { extractApiErrorMessage } from "@/lib/api";
import { getStoredLanguage, useT } from "@/lib/i18n";
import { uploadInsightScreenshot } from "@/lib/uploads";
import { updateSubmittedPostInsight } from "@/domains/application/draftsApi";
import type { DraftPost } from "./types";
import styles from "./InsightDetailDialog.module.css";

export const METRIC_LABEL: Record<AdminInsightMetricKey, AdminTranslationKey> = {
  likes: "domains.application.drafts.insightDialog.metrics.likes",
  comments: "domains.application.drafts.insightDialog.metrics.comments",
  shares: "domains.application.drafts.insightDialog.metrics.shares",
  reposts: "domains.application.drafts.insightDialog.metrics.reposts",
  saves: "domains.application.drafts.insightDialog.metrics.saves",
  views: "domains.application.drafts.insightDialog.metrics.views",
  reach: "domains.application.drafts.insightDialog.metrics.reach",
};

/** 업로드는 끝났지만 아직 저장 전인 첨부 — previewUrl 은 로컬 objectURL. */
type PendingAttachment = InsightAttachmentInput & { previewUrl: string };

type Props = {
  applicationId: string;
  post: DraftPost;
  /** 현재 화면에 보이는 이 게시물의 인사이트 스크린샷. */
  attachments: Attachment[];
  onCancel: () => void;
  onSaved: (submission: AdminSubmission) => void;
};

function toFormValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/** 빈칸은 null(값 삭제), 그 외에는 0 이상 정수만 허용. 형식이 틀리면 undefined. */
function parseMetric(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * 인사이트 오기입 보정 폼 — 지표·게시물 URL·스크린샷을 한 번에 저장한다.
 * 이미지는 저장 전에 R2 로 먼저 올리고, 저장 요청에는 objectKey 만 실어 보낸다.
 */
export function InsightEditForm({
  applicationId,
  post,
  attachments,
  onCancel,
  onSaved,
}: Props) {
  const t = useT();
  const [url, setUrl] = useState(post.url ?? "");
  const [metrics, setMetrics] = useState<Record<AdminInsightMetricKey, string>>(
    () =>
      ADMIN_INSIGHT_METRIC_KEYS.reduce(
        (acc, key) => ({ ...acc, [key]: toFormValue(post.insight[key]) }),
        {} as Record<AdminInsightMetricKey, string>,
      ),
  );
  const [added, setAdded] = useState<PendingAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keptAttachments = attachments.filter(
    (attachment) => !removedIds.includes(attachment.id),
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadInsightScreenshot(
          applicationId,
          post.subType,
          file,
        );
        setAdded((current) => [
          ...current,
          { ...uploaded, previewUrl: URL.createObjectURL(file) },
        ]);
      }
    } catch (uploadError) {
      setError(
        extractApiErrorMessage(
          uploadError,
          translate(
            "domains.application.drafts.insightDialog.uploadFailed",
            getStoredLanguage(),
          ),
        ),
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    const body: AdminUpdateInsightRequest = {
      url: url.trim() === "" ? null : url.trim(),
      addAttachments: added.map(({ previewUrl: _previewUrl, ...input }) => input),
      removeAttachmentIds: removedIds,
    };
    for (const key of ADMIN_INSIGHT_METRIC_KEYS) {
      const parsed = parseMetric(metrics[key]);
      if (parsed === undefined) {
        setError(t("domains.application.drafts.insightDialog.invalidValue"));
        return;
      }
      body[key] = parsed;
    }

    setSaving(true);
    setError(null);
    try {
      const submission = await updateSubmittedPostInsight(post.id, body);
      onSaved(submission);
    } catch (saveError) {
      setError(
        extractApiErrorMessage(
          saveError,
          translate(
            "domains.application.drafts.insightDialog.saveFailed",
            getStoredLanguage(),
          ),
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {t("domains.application.drafts.insightDialog.metricsTitle", {
          subType: SUB_TYPE_LABEL[post.subType],
        })}
      </h3>

      <div className={styles.metrics}>
        {ADMIN_INSIGHT_METRIC_KEYS.map((key) => (
          <label key={key} className={styles.metric}>
            <div className={styles.metricLabel}>{t(METRIC_LABEL[key])}</div>
            <input
              className={styles.metricInput}
              type="number"
              min={0}
              step={1}
              value={metrics[key]}
              onChange={(event) =>
                setMetrics((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>

      <div className={styles.editField}>
        <div className={styles.metricLabel}>
          {t("domains.application.drafts.insightDialog.postUrl")}
        </div>
        <input
          className={styles.urlInput}
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
        />
      </div>

      <div className={styles.editField}>
        <div className={styles.metricLabel}>
          {t("domains.application.drafts.insightDialog.screenshots")}
        </div>
        <div className={styles.grid}>
          {keptAttachments.map((attachment) => (
            <div key={attachment.id} className={styles.editTile}>
              {attachment.viewUrl && <img src={attachment.viewUrl} alt="" />}
              <button
                type="button"
                className={styles.tileRemove}
                aria-label={t(
                  "domains.application.drafts.insightDialog.removeScreenshot",
                )}
                onClick={() =>
                  setRemovedIds((current) => [...current, attachment.id])
                }
              >
                ×
              </button>
            </div>
          ))}
          {added.map((attachment) => (
            <div key={attachment.objectKey} className={styles.editTile}>
              <img src={attachment.previewUrl} alt="" />
              <button
                type="button"
                className={styles.tileRemove}
                aria-label={t(
                  "domains.application.drafts.insightDialog.removeScreenshot",
                )}
                onClick={() =>
                  setAdded((current) =>
                    current.filter(
                      (item) => item.objectKey !== attachment.objectKey,
                    ),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <label className={styles.uploadButton}>
          {uploading
            ? t("domains.application.drafts.insightDialog.uploading")
            : t("domains.application.drafts.insightDialog.addScreenshot")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            disabled={uploading || saving}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {error && <div className={styles.editError}>{error}</div>}

      <div className={styles.editActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
          disabled={saving}
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleSave()}
          disabled={saving || uploading}
        >
          {saving
            ? t("domains.application.drafts.insightDialog.saving")
            : t("domains.application.drafts.insightDialog.save")}
        </button>
      </div>
    </section>
  );
}
