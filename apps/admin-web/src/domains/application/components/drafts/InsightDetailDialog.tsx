import { useEffect, useState } from "react";
import type { SubmittedPostAttachment } from "@jsure/shared";
import { fetchSubmittedPostAttachments } from "@/domains/application/draftsApi";
import type { DraftReview } from "./types";
import styles from "./InsightDetailDialog.module.css";

type AttachmentsState =
  | { kind: "loading" }
  | { kind: "ready"; items: SubmittedPostAttachment[] }
  | { kind: "error"; message: string };

const METRICS: { key: keyof DraftReview["insight"]; label: string }[] = [
  { key: "likes", label: "いいね数" },
  { key: "comments", label: "コメント数" },
  { key: "shares", label: "シェア数" },
  { key: "reposts", label: "リポスト数" },
  { key: "saves", label: "保存数" },
  { key: "views", label: "閲覧数" },
  { key: "reach", label: "リーチ数" },
];

type Props = {
  draft: DraftReview;
  onClose: () => void;
};

function fmtNumber(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

export function InsightDetailDialog({ draft, onClose }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [attachmentsState, setAttachmentsState] = useState<AttachmentsState>({
    kind: "loading",
  });

  useEffect(() => {
    if (!draft.insightSubmitted) return;
    let cancelled = false;
    setAttachmentsState({ kind: "loading" });
    fetchSubmittedPostAttachments(draft.id)
      .then((items) => {
        if (!cancelled) setAttachmentsState({ kind: "ready", items });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAttachmentsState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "첨부 이미지를 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id, draft.insightSubmitted]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} role="presentation">
        <div
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.header}>
            <div>
              <div className={styles.title}>{draft.influencerName} 인사이트</div>
              <div className={styles.sub}>
                {draft.campaignTitle} · {draft.subType}
              </div>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          </header>

          {!draft.insightSubmitted ? (
            <div className={styles.empty}>인사이트가 아직 제출되지 않았습니다.</div>
          ) : (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>수치</h3>
                <div className={styles.metrics}>
                  {METRICS.map((m) => (
                    <div key={m.key} className={styles.metric}>
                      <div className={styles.metricLabel}>{m.label}</div>
                      <div className={styles.metricValue}>
                        {fmtNumber(draft.insight[m.key] as number | null)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  스크린샷
                  {attachmentsState.kind === "ready" && attachmentsState.items.length > 0 && (
                    <span className={styles.count}>{attachmentsState.items.length}</span>
                  )}
                </h3>
                {attachmentsState.kind === "loading" ? (
                  <div className={styles.empty}>불러오는 중…</div>
                ) : attachmentsState.kind === "error" ? (
                  <div className={styles.empty}>{attachmentsState.message}</div>
                ) : attachmentsState.items.length === 0 ? (
                  <div className={styles.empty}>첨부 이미지 없음</div>
                ) : (
                  <div className={styles.grid}>
                    {attachmentsState.items.map((attachment) => (
                      <button
                        type="button"
                        key={attachment.id}
                        className={styles.tile}
                        onClick={() =>
                          attachment.viewUrl && setLightbox(attachment.viewUrl)
                        }
                        disabled={!attachment.viewUrl}
                      >
                        {attachment.viewUrl && <img src={attachment.viewUrl} alt="" />}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>제출 URL</h3>
                <a
                  className={styles.url}
                  href={draft.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {draft.url}
                </a>
              </section>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className={styles.lightbox}
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
