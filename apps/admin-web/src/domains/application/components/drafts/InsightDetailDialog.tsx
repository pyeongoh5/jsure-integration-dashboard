import { useState } from "react";
import type { DraftReview } from "./types";
import styles from "./InsightDetailDialog.module.css";

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
                {draft.campaignTitle} · {draft.snsType}
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
                  {draft.attachments.length > 0 && (
                    <span className={styles.count}>{draft.attachments.length}</span>
                  )}
                </h3>
                {draft.attachments.length === 0 ? (
                  <div className={styles.empty}>첨부 이미지 없음</div>
                ) : (
                  <div className={styles.grid}>
                    {draft.attachments.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        className={styles.tile}
                        onClick={() => setLightbox(a.viewUrl)}
                      >
                        <img src={a.viewUrl} alt="" />
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
