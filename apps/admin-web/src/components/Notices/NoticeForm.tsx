import { useState } from "react";
import {
  fromDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
} from "./noticeTransform";
import { NoticeEditor } from "./NoticeEditor";
import "./NoticeForm.css";

export type NoticeFormValue = {
  title: string;
  contentHtml: string;
  publishedAt: string;
};

type Props = {
  initial?: NoticeFormValue;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (value: NoticeFormValue) => void;
  onCancel: () => void;
};

function defaultPublishedAt(): string {
  return new Date().toISOString();
}

export function NoticeForm({
  initial,
  busy = false,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [publishedAt, setPublishedAt] = useState(
    initial?.publishedAt ?? defaultPublishedAt(),
  );

  function handleSubmit() {
    if (!title.trim()) {
      window.alert("제목을 입력해 주세요");
      return;
    }
    if (!contentHtml.trim() || contentHtml === "<p></p>") {
      window.alert("내용을 입력해 주세요");
      return;
    }
    onSubmit({
      title: title.trim(),
      contentHtml,
      publishedAt,
    });
  }

  return (
    <div className="notice-form">
      <div className="notice-form__row">
        <label className="notice-form__label" htmlFor="notice-title">
          제목
        </label>
        <input
          id="notice-title"
          className="notice-form__input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="공지사항 제목"
          disabled={busy}
        />
      </div>

      <div className="notice-form__row">
        <label className="notice-form__label" htmlFor="notice-published-at">
          게시일
        </label>
        <input
          id="notice-published-at"
          type="datetime-local"
          className="notice-form__input"
          value={toDateTimeLocalInputValue(publishedAt)}
          onChange={(event) =>
            setPublishedAt(fromDateTimeLocalInputValue(event.target.value))
          }
          disabled={busy}
        />
      </div>

      <div className="notice-form__row">
        <span className="notice-form__label">내용</span>
        <NoticeEditor value={contentHtml} onChange={setContentHtml} />
      </div>

      {error ? <div className="notice-form__error">{error}</div> : null}

      <div className="notice-form__actions">
        <button
          type="button"
          className="notice-form__btn"
          onClick={onCancel}
          disabled={busy}
        >
          취소
        </button>
        <button
          type="button"
          className="notice-form__btn notice-form__btn--primary"
          onClick={handleSubmit}
          disabled={busy}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
