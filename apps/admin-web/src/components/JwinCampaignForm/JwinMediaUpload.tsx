import { useRef } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useJwinMediaUpload } from "./useJwinMediaUpload";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  labelKey: AdminTranslationKey;
  /** 저장된 공개 URL. 없으면 null */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

/** URL 확장자로 동영상 여부를 본다. R2 공개 URL 은 확장자를 유지한다. */
function isVideo(url: string): boolean {
  return url.toLowerCase().endsWith(".mp4");
}

/**
 * 파일 선택 → presign → R2 PUT → 만료 없는 공개 URL 을 onChange 로 올려보낸다 (D-12).
 * 소재 탭과 결과화면 탭이 함께 쓴다.
 */
export function JwinMediaUpload({ labelKey, value, onChange, disabled = false }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, error, upload, clearError } = useJwinMediaUpload();
  const label = t(labelKey);

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
    // 같은 파일을 다시 고를 수 있도록 입력값을 비운다
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = () => {
    clearError();
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={styles.upload}>
      <span className={styles.uploadLabel}>{label}</span>
      <input
        ref={inputRef}
        type="file"
        className={styles.fileInput}
        accept="image/png,image/jpeg,image/webp,video/mp4"
        onChange={(event) => void handleSelect(event.target.files?.[0])}
      />
      <div className={styles.uploadRow}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? t("jwin.upload.uploading") : t("jwin.upload.select")}
        </Button>
        {value && !uploading && (
          <Button variant="secondary" size="md" onClick={handleRemove} disabled={disabled}>
            {t("jwin.upload.remove")}
          </Button>
        )}
        {!value && !uploading && <span className={styles.uploadHint}>{t("jwin.upload.hint")}</span>}
      </div>
      {value && isVideo(value) && (
        <video className={styles.preview} src={value} controls preload="metadata" />
      )}
      {value && !isVideo(value) && <img className={styles.preview} src={value} alt={label} />}
      {error && <span className={styles.uploadError}>{error}</span>}
    </div>
  );
}
