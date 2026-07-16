import { useEffect, useMemo, useState } from "react";
import {
  QOO10_REVIEW_CHANNEL_LABEL,
  SUB_TYPE_LABEL,
  type Attachment,
  type AttachmentKind,
} from "@jsure/shared";
import { SegmentedTabs } from "@/components/composites";
import { fetchApplicationAttachments } from "@/domains/application/draftsApi";
import type { DraftReview, InsightMetrics } from "./types";
import styles from "./InsightDetailDialog.module.css";

type AttachmentsState =
  | { kind: "loading" }
  | { kind: "ready"; items: Attachment[] }
  | { kind: "error"; message: string };

const METRICS: { key: keyof InsightMetrics; label: string }[] = [
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
  // SNS 다중 서브타입은 탭으로 분리해 한 번에 한 서브타입 결과만 표시.
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const isFakePurchase = draft.category === "FAKE_PURCHASE";
  const isSimpleReview = draft.category === "SIMPLE_REVIEW";
  const isReviewCategory = isFakePurchase || isSimpleReview;
  // SNS 는 리뷰(URL) 제출 시점부터 모달로 확인 가능 — 인사이트 미제출 서브타입은 표식으로 표시.
  const contentSubmitted = isReviewCategory || draft.posts.length > 0;
  const activePost = isReviewCategory
    ? null
    : (draft.posts.find((post) => post.id === activePostId) ??
      draft.posts[0] ??
      null);
  const visiblePosts = isReviewCategory
    ? draft.posts
    : activePost
      ? [activePost]
      : [];
  const dialogTitle = isReviewCategory
    ? `${draft.influencerName} 리뷰`
    : `${draft.influencerName} 인사이트`;
  const emptyLabel = isReviewCategory
    ? "리뷰가 아직 제출되지 않았습니다."
    : "인사이트가 아직 제출되지 않았습니다.";
  const screenshotTitle = isReviewCategory ? "리뷰 스크린샷" : "스크린샷";
  const attachmentKind: AttachmentKind = isReviewCategory
    ? "REVIEW_SCREENSHOT"
    : "INSIGHT_SCREENSHOT";
  const filteredAttachments = useMemo(() => {
    if (attachmentsState.kind !== "ready") return [];
    const kindFiltered = attachmentsState.items.filter(
      (item) => item.kind === attachmentKind,
    );
    if (isReviewCategory || !activePost) return kindFiltered;
    // SNS 탭: 활성 서브타입 게시물의 첨부만 표시.
    const activeAttachmentIds = new Set(
      activePost.attachments.map((attachment) => attachment.id),
    );
    return kindFiltered.filter((item) => activeAttachmentIds.has(item.id));
  }, [attachmentsState, attachmentKind, isReviewCategory, activePost]);
  const submittedUrls = visiblePosts.filter((post) => post.url !== null);

  useEffect(() => {
    if (!contentSubmitted) return;
    let cancelled = false;
    setAttachmentsState({ kind: "loading" });
    fetchApplicationAttachments(draft.id)
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
  }, [draft.id, contentSubmitted]);

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
              <div className={styles.title}>{dialogTitle}</div>
              <div className={styles.sub}>
                {draft.campaignTitle} ·{" "}
                {draft.subTypes
                  .map((subType) => SUB_TYPE_LABEL[subType])
                  .join(" · ")}
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

          {!contentSubmitted ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : (
            <>
              {!isReviewCategory && draft.posts.length > 1 && (
                <SegmentedTabs
                  className={styles.subTypeTabs}
                  items={draft.posts.map((post) => ({
                    key: post.id,
                    label: SUB_TYPE_LABEL[post.subType],
                  }))}
                  value={activePost?.id ?? ""}
                  onChange={setActivePostId}
                />
              )}

              {!isReviewCategory &&
                visiblePosts.map((post) => (
                  <section key={post.id} className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      {SUB_TYPE_LABEL[post.subType]} 수치
                    </h3>
                    {post.insightSubmitted ? (
                      <div className={styles.metrics}>
                        {METRICS.map((m) => (
                          <div key={m.key} className={styles.metric}>
                            <div className={styles.metricLabel}>{m.label}</div>
                            <div className={styles.metricValue}>
                              {fmtNumber(post.insight[m.key] as number | null)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.empty}>인사이트 미제출</div>
                    )}
                  </section>
                ))}

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {screenshotTitle}
                  {attachmentsState.kind === "ready" && filteredAttachments.length > 0 && (
                    <span className={styles.count}>{filteredAttachments.length}</span>
                  )}
                </h3>
                {attachmentsState.kind === "loading" ? (
                  <div className={styles.empty}>불러오는 중…</div>
                ) : attachmentsState.kind === "error" ? (
                  <div className={styles.empty}>{attachmentsState.message}</div>
                ) : filteredAttachments.length === 0 ? (
                  <div className={styles.empty}>첨부 이미지 없음</div>
                ) : (
                  <div className={styles.grid}>
                    {filteredAttachments.map((attachment) => (
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

              {submittedUrls.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>제출 URL</h3>
                  {submittedUrls.map((post) => (
                    <div key={post.id}>
                      <span className={styles.reviewChannelLabel}>
                        {SUB_TYPE_LABEL[post.subType]}
                      </span>
                      <a
                        className={styles.url}
                        href={post.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {post.url}
                      </a>
                    </div>
                  ))}
                </section>
              )}

              {isFakePurchase &&
                (Object.keys(draft.reviewUrls) as ("LIPS" | "ATCOSME")[])
                  .length > 0 && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>추가 리뷰 URL</h3>
                    {(Object.keys(draft.reviewUrls) as ("LIPS" | "ATCOSME")[])
                      .map((channel) => {
                        const reviewUrl = draft.reviewUrls[channel];
                        if (!reviewUrl) return null;
                        return (
                          <div key={channel}>
                            <span className={styles.reviewChannelLabel}>
                              {QOO10_REVIEW_CHANNEL_LABEL[channel]}
                            </span>
                            <a
                              className={styles.url}
                              href={reviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {reviewUrl}
                            </a>
                          </div>
                        );
                      })}
                  </section>
                )}
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
