import { useRef, useState } from "react";
import type { SnsType } from "@jsure/shared";
import { LabeledInput } from "../composites/LabeledInput";
import { PrimaryButton } from "../composites/PrimaryButton";
import { presignInsightUpload } from "../../lib/api/applications";
import "./InsightSubmitForm.css";

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
  snsType: SnsType;
  initial: Metrics | null;
  onSubmit: (v: InsightInput) => Promise<void>;
  submitting: boolean;
}

function fromInitial(initial: Metrics | null): Record<MetricKey, string> {
  const base: Record<MetricKey, string> = {
    likes: "",
    comments: "",
    shares: "",
    reposts: "",
    saves: "",
    views: "",
    reach: "",
  };
  if (!initial) return base;
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
  snsType,
  initial,
  onSubmit,
  submitting,
}: Props) {
  const [values, setValues] = useState(() => fromInitial(initial));
  const [touched, setTouched] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setField(key: MetricKey, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw.replace(/[^\d]/g, "") }));
  }

  const errors: Partial<Record<MetricKey, string>> = {};
  for (const f of METRIC_FIELDS) {
    if (!/^\d+$/.test(values[f.key])) errors[f.key] = "数字を入力";
  }
  const valid = Object.keys(errors).length === 0;
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
      snsType,
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
    setPendingCount((c) => c + list.length);
    try {
      for (const f of list) {
        try {
          const att = await uploadOne(f);
          if (att) setAttachments((prev) => [...prev, att]);
        } finally {
          setPendingCount((c) => c - 1);
        }
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "アップロード中にエラーが発生しました",
      );
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function openPicker() {
    if (busy || remaining <= 0) return;
    fileInputRef.current?.click();
  }

  async function handle() {
    setTouched(true);
    if (!valid) return;
    await onSubmit({
      likes: Number(values.likes),
      comments: Number(values.comments),
      shares: Number(values.shares),
      reposts: Number(values.reposts),
      saves: Number(values.saves),
      views: Number(values.views),
      reach: Number(values.reach),
      attachments: attachments.map((a) => ({
        objectKey: a.objectKey,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
      })),
    });
  }

  return (
    <div>
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
      </div>

      {METRIC_FIELDS.map((f) => (
        <LabeledInput
          key={f.key}
          label={f.label}
          type="text"
          inputMode="numeric"
          value={values[f.key]}
          onChange={(v) => setField(f.key, v)}
          error={touched ? errors[f.key] : undefined}
        />
      ))}

      <div className="isf-section">
        <div className="isf-section-title">インサイトのスクリーンショット</div>
        <div className="isf-section-hint">
          PNG / JPEG / WebP · 最大{MAX_FILES}枚 · 5MB以下
        </div>

        <div
          className={`isf-dropzone ${dragOver ? "isf-dropzone--drag" : ""} ${
            busy || remaining <= 0 ? "isf-dropzone--disabled" : ""
          }`}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy && remaining > 0) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy && remaining > 0) handleFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
        >
          <i className="isf-dropzone__icon fa-regular fa-image" />
          <div className="isf-dropzone__main">
            {uploading
              ? "アップロード中…"
              : remaining <= 0
                ? "添付枚数が上限に達しました"
                : "クリックまたはドラッグして画像を追加"}
          </div>
          <div className="isf-dropzone__sub">
            {attachments.length}/{MAX_FILES} 枚
          </div>
          <input
            ref={fileInputRef}
            className="isf-dropzone__hidden-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={busy || remaining <= 0}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && <div className="isf-error">{uploadError}</div>}

        {(attachments.length > 0 || pendingCount > 0) && (
          <div className="isf-grid">
            {attachments.map((a, i) => (
              <div key={a.objectKey} className="isf-tile">
                <img src={a.previewUrl} alt={a.name} className="isf-tile__img" />
                <button
                  type="button"
                  className="isf-tile__remove"
                  onClick={() => removeAttachment(i)}
                  disabled={busy}
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            ))}
            {Array.from({ length: pendingCount }).map((_, i) => (
              <div key={`pending-${i}`} className="isf-tile">
                <div className="isf-tile__loading">アップロード中…</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PrimaryButton onClick={handle} disabled={busy}>
        {submitting
          ? "送信中…"
          : uploading
            ? "アップロード中…"
            : "インサイトを提出"}
      </PrimaryButton>
    </div>
  );
}
