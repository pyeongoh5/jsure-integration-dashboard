import { useState } from "react";
import {
  fromDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
} from "./noticeTransform";
import { NoticeEditor } from "./NoticeEditor";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./NoticeForm.module.css";

export type NoticeFormValue = {
  title: string;
  contentHtml: string;
  startAt: string;
  endAt: string;
};

type Props = {
  initial?: NoticeFormValue;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (value: NoticeFormValue) => void;
  onCancel: () => void;
};

function defaultStartAt(): string {
  return new Date().toISOString();
}

function defaultEndAt(): string {
  // 시작일 + 30일
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

/**
 * 에디터의 img src 는 미리보기용 presigned URL 이지만 저장 시에는
 * `r2:<objectKey>` 형태로 되돌려야 서버측 영구 저장과 호환된다.
 * data-r2-key 속성을 보고 src 를 치환하고 속성은 제거.
 */
function serializeContentHtml(html: string): string {
  return html.replace(
    /<img\b([^>]*)\bdata-r2-key="([^"]+)"([^>]*)>/g,
    (_match, before: string, key: string, after: string) => {
      const restored = `${before}${after}`.replace(
        /\bsrc="[^"]*"/,
        `src="r2:${key}"`,
      );
      return `<img${restored}>`;
    },
  );
}

export function NoticeForm({
  initial,
  busy = false,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const t = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? defaultStartAt());
  const [endAt, setEndAt] = useState(initial?.endAt ?? defaultEndAt());

  function handleSubmit() {
    if (!title.trim()) {
      window.alert(t("domains.notice.form.titleRequired"));
      return;
    }
    if (!contentHtml.trim() || contentHtml === "<p></p>") {
      window.alert(t("domains.notice.form.contentRequired"));
      return;
    }
    if (new Date(startAt) >= new Date(endAt)) {
      window.alert(t("domains.notice.form.endAfterStart"));
      return;
    }
    // 업로드가 끝나지 않은 이미지 (data-r2-key 없음) 가 있으면 차단
    if (/<img\b(?![^>]*\bdata-r2-key=)[^>]*>/.test(contentHtml)) {
      window.alert(t("domains.notice.form.imageUploadIncomplete"));
      return;
    }
    onSubmit({
      title: title.trim(),
      contentHtml: serializeContentHtml(contentHtml),
      startAt,
      endAt,
    });
  }

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="notice-title">
          {t("domains.notice.form.titleLabel")}
        </label>
        <input
          id="notice-title"
          className={styles.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder={t("domains.notice.form.titlePlaceholder")}
          disabled={busy}
        />
      </div>

      <div className={`${styles.row} ${styles.rowInline}`}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="notice-start-at">
            {t("domains.notice.form.startAtLabel")}
          </label>
          <input
            id="notice-start-at"
            type="datetime-local"
            className={styles.input}
            value={toDateTimeLocalInputValue(startAt)}
            onChange={(event) =>
              setStartAt(fromDateTimeLocalInputValue(event.target.value))
            }
            disabled={busy}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="notice-end-at">
            {t("domains.notice.form.endAtLabel")}
          </label>
          <input
            id="notice-end-at"
            type="datetime-local"
            className={styles.input}
            value={toDateTimeLocalInputValue(endAt)}
            onChange={(event) =>
              setEndAt(fromDateTimeLocalInputValue(event.target.value))
            }
            disabled={busy}
          />
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>{t("domains.notice.form.contentLabel")}</span>
        <NoticeEditor value={contentHtml} onChange={setContentHtml} />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={busy}
          loading={busy}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
