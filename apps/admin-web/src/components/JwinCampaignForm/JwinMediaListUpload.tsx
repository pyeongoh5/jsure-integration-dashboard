import { useRef } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { POST_MEDIA_MAX } from "@jsure/jwin-shared";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useJwinMediaUpload } from "./useJwinMediaUpload";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  labelKey: AdminTranslationKey;
  /** 저장된 공개 URL 목록. 순서가 그대로 트윗 첨부 순서가 된다. */
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
};

/** URL 확장자로 동영상 여부를 본다. R2 공개 URL 은 확장자를 유지한다. */
function isVideo(url: string): boolean {
  return url.toLowerCase().endsWith(".mp4");
}

/**
 * 미디어 여러 장 업로드 (최대 POST_MEDIA_MAX 장 — X 트윗 첨부 한도).
 * 한 장짜리 JwinMediaUpload 와 달리 순서를 유지한 목록을 돌려준다.
 */
export function JwinMediaListUpload({ labelKey, value, onChange, disabled = false }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, error, upload, clearError } = useJwinMediaUpload();
  const label = t(labelKey);
  const isFull = value.length >= POST_MEDIA_MAX;

  const handleSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = POST_MEDIA_MAX - value.length;
    const uploaded: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const url = await upload(file);
      if (!url) break;
      uploaded.push(url);
    }
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    // 같은 파일을 다시 고를 수 있도록 입력값을 비운다
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (url: string) => {
    clearError();
    onChange(value.filter((item) => item !== url));
  };

  return (
    <div className={styles.upload}>
      <span className={styles.uploadLabel}>
        {label} ({value.length}/{POST_MEDIA_MAX})
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple
        className={styles.fileInput}
        accept="image/png,image/jpeg,image/webp,video/mp4"
        onChange={(event) => void handleSelect(event.target.files)}
      />
      <div className={styles.uploadRow}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || isFull}
        >
          {uploading ? t("jwin.upload.uploading") : t("jwin.upload.select")}
        </Button>
        <span className={styles.uploadHint}>
          {isFull ? t("jwin.upload.maxReached", { max: POST_MEDIA_MAX }) : t("jwin.upload.hint")}
        </span>
      </div>

      {value.length > 0 && (
        <div className={styles.mediaGrid}>
          {value.map((url) => (
            <div key={url} className={styles.mediaItem}>
              {isVideo(url) ? (
                <video className={styles.preview} src={url} controls preload="metadata" />
              ) : (
                <img className={styles.preview} src={url} alt={label} />
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRemove(url)}
                disabled={disabled || uploading}
              >
                {t("jwin.upload.remove")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <span className={styles.uploadError}>{error}</span>}
    </div>
  );
}
