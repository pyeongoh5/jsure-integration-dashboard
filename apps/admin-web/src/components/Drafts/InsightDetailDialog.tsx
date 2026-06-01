import { useState } from "react";
import type { DraftReview } from "./types";
import "./InsightDetailDialog.css";

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
      <div className="idd-overlay" onClick={onClose} role="presentation">
        <div
          className="idd-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="idd-header">
            <div>
              <div className="idd-title">{draft.influencerName} 인사이트</div>
              <div className="idd-sub">
                {draft.campaignTitle} · {draft.snsType}
              </div>
            </div>
            <button
              type="button"
              className="idd-close"
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          </header>

          {!draft.insightSubmitted ? (
            <div className="idd-empty">인사이트가 아직 제출되지 않았습니다.</div>
          ) : (
            <>
              <section className="idd-section">
                <h3 className="idd-section-title">수치</h3>
                <div className="idd-metrics">
                  {METRICS.map((m) => (
                    <div key={m.key} className="idd-metric">
                      <div className="idd-metric__label">{m.label}</div>
                      <div className="idd-metric__value">
                        {fmtNumber(draft.insight[m.key] as number | null)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="idd-section">
                <h3 className="idd-section-title">
                  스크린샷
                  {draft.attachments.length > 0 && (
                    <span className="idd-count">{draft.attachments.length}</span>
                  )}
                </h3>
                {draft.attachments.length === 0 ? (
                  <div className="idd-empty">첨부 이미지 없음</div>
                ) : (
                  <div className="idd-grid">
                    {draft.attachments.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        className="idd-tile"
                        onClick={() => setLightbox(a.viewUrl)}
                      >
                        <img src={a.viewUrl} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="idd-section">
                <h3 className="idd-section-title">제출 URL</h3>
                <a
                  className="idd-url"
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
          className="idd-lightbox"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
