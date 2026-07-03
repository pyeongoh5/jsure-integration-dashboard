import { useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CampaignSubType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { presignInsightUpload } from "../api";
import styles from "./InsightSubmitForm.module.css";

type ImgContentType = "image/png" | "image/jpeg" | "image/webp";

const ALLOWED: ImgContentType[] = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

const METRIC_FIELDS = [
  { key: "likes", label: "いいね数" },
  { key: "comments", label: "コメント数" },
  { key: "shares", label: "シェア数" },
  { key: "reposts", label: "リポスト数" },
  { key: "saves", label: "保存数" },
  { key: "views", label: "閲覧数" },
  { key: "reach", label: "リーチ数" },
] as const;

type MetricKey = (typeof METRIC_FIELDS)[number]["key"];
type Metrics = Record<MetricKey, number>;

const metricSchema = z.string().regex(/^\d+$/, "数字を入力");

const schema = z.object({
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  reposts: metricSchema,
  saves: metricSchema,
  views: metricSchema,
  reach: metricSchema,
});
type Values = z.infer<typeof schema>;

const EMPTY_VALUES: Values = {
  likes: "",
  comments: "",
  shares: "",
  reposts: "",
  saves: "",
  views: "",
  reach: "",
};

interface Attachment {
  objectKey: string;
  contentType: ImgContentType;
  sizeBytes: number;
  previewUrl: string;
  name: string;
}

interface InsightInput extends Metrics {
  attachments?: {
    objectKey: string;
    contentType: ImgContentType;
    sizeBytes: number;
  }[];
}

interface Props {
  applicationId: string;
  subType: CampaignSubType;
  initial: Metrics | null;
  onSubmit: (value: InsightInput) => Promise<void>;
  submitting: boolean;
  postSubmittedAt: string;
}

function formatInsightDueDate(iso: string): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + 7);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fromInitial(initial: Metrics | null): Values {
  if (!initial) return EMPTY_VALUES;
  return {
    likes: String(initial.likes),
    comments: String(initial.comments),
    shares: String(initial.shares),
    reposts: String(initial.reposts),
    saves: String(initial.saves),
    views: String(initial.views),
    reach: String(initial.reach),
  };
}

export function InsightSubmitForm({
  applicationId,
  subType,
  initial,
  onSubmit,
  submitting,
  postSubmittedAt,
}: Props) {
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: fromInitial(initial),
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = pendingCount > 0;
  const busy = submitting || uploading;
  const remaining = MAX_FILES - attachments.length;

  async function uploadOne(file: File): Promise<Attachment | null> {
    if (!ALLOWED.includes(file.type as ImgContentType)) {
      setUploadError(`対応していない形式: ${file.name}`);
      return null;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`5MB を超えるファイル: ${file.name}`);
      return null;
    }
    const contentType = file.type as ImgContentType;
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
      setUploadError(`アップロード失敗: ${file.name}`);
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
      setUploadError(`最大${MAX_FILES}枚まで添付できます`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setPendingCount((count) => count + list.length);
    try {
      for (const file of list) {
        try {
          const attachment = await uploadOne(file);
          if (attachment) {
            setAttachments((prev) => [...prev, attachment]);
          }
        } finally {
          setPendingCount((count) => count - 1);
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロード中にエラーが発生しました");
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function openPicker() {
    if (busy || remaining <= 0) return;
    fileInputRef.current?.click();
  }

  async function handle(values: Values) {
    await onSubmit({
      likes: Number(values.likes),
      comments: Number(values.comments),
      shares: Number(values.shares),
      reposts: Number(values.reposts),
      saves: Number(values.saves),
      views: Number(values.views),
      reach: Number(values.reach),
      attachments: attachments.map((attachment) => ({
        objectKey: attachment.objectKey,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      })),
    });
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handle)}>
        <div
          style={{
            background: "#fef3c7",
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            color: "#92400e",
            marginBottom: 14,
          }}
        >
          投稿のインサイトをご提出ください。
          <div
            style={{
              marginTop: 6,
              color: "#dc2626",
              fontWeight: 600,
            }}
          >
            インサイト提出日: {formatInsightDueDate(postSubmittedAt)}
          </div>
        </div>

        {METRIC_FIELDS.map((metric) => (
          <div key={metric.key}>
            <FormField name={metric.key} label={metric.label}>
              {(field) => (
                <Input
                  id={field.id}
                  type="text"
                  inputMode="numeric"
                  value={field.value}
                  onChange={(value) => field.onChange(value.replace(/[^\d]/g, ""))}
                  onBlur={field.onBlur}
                  error={field.error}
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>
            {metric.key === "reach" && (
              <p
                style={{
                  marginTop: -6,
                  marginBottom: 12,
                  fontSize: 11,
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                リーチ数が表示されない場合は、「0」とご入力いただくようお願いいたします。
              </p>
            )}
          </div>
        ))}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>インサイトのスクリーンショット</div>
          <div className={styles.sectionHint}>PNG / JPEG / WebP · 最大{MAX_FILES}枚 · 5MB以下</div>

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
                ? "アップロード中…"
                : remaining <= 0
                  ? "添付枚数が上限に達しました"
                  : "クリックまたはドラッグして画像を追加"}
            </div>
            <div className={styles.dropzoneSub}>
              {attachments.length}/{MAX_FILES} 枚
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
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              {Array.from({ length: pendingCount }).map((_, index) => (
                <div key={`pending-${index}`} className={styles.tile}>
                  <div className={styles.tileLoading}>アップロード中…</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <PrimaryButton type="submit" disabled={busy}>
          {submitting ? "送信中…" : uploading ? "アップロード中…" : "インサイトを提出"}
        </PrimaryButton>
      </form>
    </FormProvider>
  );
}
