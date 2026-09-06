import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_INSIGHT_METRIC_KEYS,
  CROSS_POST_PLATFORM_LABEL,
  QOO10_REVIEW_CHANNEL_LABEL,
  SUB_TYPE_LABEL,
  type AdminSubmission,
  type Attachment,
  type AttachmentKind,
} from "@jsure/shared";
import { translate } from "@i18n/admin";
import { SegmentedTabs } from "@/components/composites";
import { getStoredLanguage, useLanguage, useT } from "@/lib/i18n";
import { fetchApplicationAttachments } from "@/domains/application/draftsApi";
import { toDraftReview } from "./draftTransform";
import { InsightEditForm, METRIC_LABEL } from "./InsightEditForm";
import type { DraftReview } from "./types";
import styles from "./InsightDetailDialog.module.css";

type AttachmentsState =
  | { kind: "loading" }
  | { kind: "ready"; items: Attachment[] }
  | { kind: "error"; message: string };

type Props = {
  draft: DraftReview;
  onClose: () => void;
  /** 인사이트 보정 저장 후 — 호출부 목록을 갱신한다. */
  onSaved?: () => void;
};

function fmtNumber(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

export function InsightDetailDialog({
  draft: sourceDraft,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { language } = useLanguage();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [attachmentsState, setAttachmentsState] = useState<AttachmentsState>({
    kind: "loading",
  });
  // 보정 저장 후 서버가 돌려준 최신 제출물 — 모달을 닫지 않고 그 자리에서 갱신한다.
  const [edited, setEdited] = useState<DraftReview | null>(null);
  const [editing, setEditing] = useState(false);
  const [attachmentsReloadKey, setAttachmentsReloadKey] = useState(0);
  const draft = edited ?? sourceDraft;
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
    ? t("domains.application.drafts.insightDialog.reviewTitle", {
        name: draft.influencerName,
      })
    : t("domains.application.drafts.insightDialog.insightTitle", {
        name: draft.influencerName,
      });
  const emptyLabel = isReviewCategory
    ? t("domains.application.drafts.insightDialog.reviewNotSubmitted")
    : t("domains.application.drafts.insightDialog.insightNotSubmitted");
  const screenshotTitle = isReviewCategory
    ? t("domains.application.drafts.insightDialog.reviewScreenshots")
    : t("domains.application.drafts.insightDialog.screenshots");
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
  const submittedUrls = visiblePosts.filter((post) => post.urls.length > 0);
  // 보정 대상은 인사이트가 제출된 SNS 게시물뿐 — 리뷰 카테고리·미제출 건은 제외.
  const canEdit = activePost !== null && activePost.insightSubmitted;
  // 가구매는 주문 명세서(ORDER_RECEIPT)도 같은 첨부 응답에 실려온다.
  const orderReceipts =
    isFakePurchase && attachmentsState.kind === "ready"
      ? attachmentsState.items.filter((item) => item.kind === "ORDER_RECEIPT")
      : [];

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
              : translate(
                  "domains.application.drafts.insightDialog.attachmentsLoadFailed",
                  getStoredLanguage(),
                ),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id, contentSubmitted, attachmentsReloadKey]);

  function handleSaved(submission: AdminSubmission) {
    setEdited(toDraftReview(submission, new Date(), language));
    setEditing(false);
    setAttachmentsReloadKey((current) => current + 1);
    onSaved?.();
  }

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
            <div className={styles.headerActions}>
              {canEdit && !editing && (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setEditing(true)}
                >
                  {t("domains.application.drafts.insightDialog.edit")}
                </button>
              )}
              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
          </header>

          {!contentSubmitted ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : (
            <>
              {isFakePurchase && (
                <>
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      {t("domains.application.drafts.insightDialog.orderInfo")}
                    </h3>
                    <div className={styles.fields}>
                      <div className={styles.fieldLabel}>
                        {t("domains.application.drafts.insightDialog.orderNumber")}
                      </div>
                      <div className={styles.fieldValue}>
                        {draft.orderNumber ?? "—"}
                      </div>
                    </div>
                  </section>

                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      {t("domains.application.drafts.insightDialog.orderReceipt")}
                      {orderReceipts.length > 0 && (
                        <span className={styles.count}>
                          {orderReceipts.length}
                        </span>
                      )}
                    </h3>
                    {attachmentsState.kind === "loading" ? (
                      <div className={styles.empty}>{t("common.loading")}</div>
                    ) : orderReceipts.length === 0 ? (
                      <div className={styles.empty}>
                        {t(
                          "domains.application.drafts.insightDialog.receiptNotSubmitted",
                        )}
                      </div>
                    ) : (
                      <div className={styles.grid}>
                        {orderReceipts.map((attachment) => (
                          <button
                            type="button"
                            key={attachment.id}
                            className={styles.tile}
                            onClick={() =>
                              attachment.viewUrl &&
                              setLightbox(attachment.viewUrl)
                            }
                            disabled={!attachment.viewUrl}
                          >
                            {attachment.viewUrl && (
                              <img src={attachment.viewUrl} alt="" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {!isReviewCategory && !editing && draft.posts.length > 1 && (
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

              {editing && activePost && (
                <InsightEditForm
                  applicationId={draft.id}
                  post={activePost}
                  attachments={filteredAttachments}
                  onCancel={() => setEditing(false)}
                  onSaved={handleSaved}
                />
              )}

              {!isReviewCategory &&
                !editing &&
                visiblePosts.map((post) => (
                  <section key={post.id} className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      {t("domains.application.drafts.insightDialog.metricsTitle", {
                        subType: SUB_TYPE_LABEL[post.subType],
                      })}
                    </h3>
                    {post.insightSubmitted ? (
                      <div className={styles.metrics}>
                        {ADMIN_INSIGHT_METRIC_KEYS.map((key) => (
                          <div key={key} className={styles.metric}>
                            <div className={styles.metricLabel}>
                              {t(METRIC_LABEL[key])}
                            </div>
                            <div className={styles.metricValue}>
                              {fmtNumber(post.insight[key])}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.empty}>
                        {t("domains.application.drafts.insightDialog.insightMissing")}
                      </div>
                    )}
                  </section>
                ))}

              {!editing && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    {screenshotTitle}
                    {attachmentsState.kind === "ready" && filteredAttachments.length > 0 && (
                      <span className={styles.count}>{filteredAttachments.length}</span>
                    )}
                  </h3>
                  {attachmentsState.kind === "loading" ? (
                    <div className={styles.empty}>{t("common.loading")}</div>
                  ) : attachmentsState.kind === "error" ? (
                    <div className={styles.empty}>{attachmentsState.message}</div>
                  ) : filteredAttachments.length === 0 ? (
                    <div className={styles.empty}>
                      {t("domains.application.drafts.insightDialog.noAttachments")}
                    </div>
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
              )}

              {!editing && submittedUrls.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    {t("domains.application.drafts.insightDialog.submittedUrls")}
                  </h3>
                  {submittedUrls.map((post) => (
                    <div key={post.id}>
                      <span className={styles.reviewChannelLabel}>
                        {SUB_TYPE_LABEL[post.subType]}
                      </span>
                      {/* 단순리뷰는 상품 수만큼 URL 이 여러 개 올 수 있다.
                          긴 URL 이 여러 줄로 접히므로 번호와 구분선으로 경계를 만든다. */}
                      <span className={styles.urlList}>
                        {post.urls.map((url, index) => (
                          <span key={url} className={styles.urlItem}>
                            {post.urls.length > 1 && (
                              <span className={styles.urlIndex}>
                                {index + 1}
                              </span>
                            )}
                            <a
                              className={styles.url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {url}
                            </a>
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </section>
              )}

              {isFakePurchase &&
                (Object.keys(draft.reviewUrls) as ("LIPS" | "ATCOSME")[])
                  .length > 0 && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      {t("domains.application.drafts.insightDialog.extraReviewUrls")}
                    </h3>
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

              {draft.crossPosts.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    {t("domains.application.drafts.insightDialog.extraShares")}
                  </h3>
                  {draft.crossPosts.map((crossPost) => (
                    <div key={crossPost.id}>
                      <span className={styles.reviewChannelLabel}>
                        {crossPost.platform === "OTHER"
                          ? crossPost.platformName
                          : CROSS_POST_PLATFORM_LABEL[crossPost.platform]}
                      </span>
                      <a
                        className={styles.url}
                        href={crossPost.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {crossPost.url}
                      </a>
                    </div>
                  ))}
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
