import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CampaignSubType } from "@jsure/shared";
import { useState } from "react";
import {
  ApplicationStepper,
  CancelConfirmDialog,
  InsightSubmitForm,
  OrderSubmitForm,
  PostSubmitForm,
  ReceiptConfirmDialog,
  ReviewSubmitForm,
  StageBadge,
  cancelApplication,
  confirmReceipt,
  submitInsight,
  submitOrder,
  submitPost,
  submitReview,
  useApplication,
} from "@/domains/application";
import type { AttachmentUploadInput } from "@jsure/shared";
import { PageHeader } from "@/components/composites/PageHeader";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import styles from "./ApplicationDetail.module.css";

export function ApplicationDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useApplication(id);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["application", id] });
    qc.invalidateQueries({ queryKey: ["applications"] });
    qc.invalidateQueries({ queryKey: ["influencer-campaign"] });
    qc.invalidateQueries({ queryKey: ["influencer-campaigns"] });
  }

  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancel = useMutation({
    mutationFn: () => cancelApplication(id),
    onSuccess: () => {
      invalidate();
      // 취소된 응모는 인플루언서에게 보이지 않도록 처리되므로
      // 상세 페이지에서 즉시 캠페인 목록으로 이동.
      nav("/", { replace: true });
    },
  });
  const receive = useMutation({
    mutationFn: () => confirmReceipt(id),
    onSuccess: () => {
      invalidate();
      setShowReceiptDialog(false);
    },
  });
  const post = useMutation({
    mutationFn: ({ subType, url }: { subType: CampaignSubType; url: string }) =>
      submitPost(id, subType, url),
    onSuccess: () => invalidate(),
  });
  const order = useMutation({
    mutationFn: ({
      orderNumber,
      receipts,
    }: {
      orderNumber: string;
      receipts: AttachmentUploadInput[];
    }) => submitOrder(id, orderNumber, receipts),
    onSuccess: () => invalidate(),
  });
  const review = useMutation({
    mutationFn: ({
      reviewUrl,
      screenshots,
    }: {
      reviewUrl: string;
      screenshots: AttachmentUploadInput[];
    }) => submitReview(id, reviewUrl, screenshots),
    onSuccess: () => invalidate(),
  });
  const insight = useMutation({
    mutationFn: ({
      subType,
      input,
    }: {
      subType: CampaignSubType;
      input: {
        likes: number;
        comments: number;
        shares: number;
        reposts: number;
        saves: number;
        views: number;
        reach: number;
        attachments?: {
          objectKey: string;
          contentType: "image/png" | "image/jpeg" | "image/webp";
          sizeBytes: number;
        }[];
      };
    }) => submitInsight(id, subType, input),
    onSuccess: () => invalidate(),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.center}>{t("pages.applications.detail.loading")}</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.center}>{t("pages.applications.detail.loadError")}</div>
      </div>
    );
  }

  const stage = data.displayStage;
  // 응모 후 2일 이내에만 인플루언서가 직접 취소 가능. 이후엔 버튼 자체를 숨김.
  const CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
  const appliedAtMs = new Date(data.appliedAt).getTime();
  const withinCancelWindow = Date.now() - appliedAtMs <= CANCEL_WINDOW_MS;
  const canCancel = data.status === "APPLIED" && withinCancelWindow;

  return (
    <div>
      <PageHeader showBack title={data.campaignTitle} />
      <div className={styles.top}>
        <div className={styles.headRow}>
          <div className={styles.title}>{data.campaignTitle}</div>
          <StageBadge stage={stage} />
        </div>
        <div className={styles.reward}>¥{data.rewardJpy.toLocaleString("ja-JP")}</div>
        <div className={styles.stepper}>
          <ApplicationStepper stage={stage} />
        </div>
      </div>

      <div className={styles.sections}>
        {stage === "APPLIED" && (
          <p className={styles.msg}>{t("pages.applications.detail.msgApplied")}</p>
        )}
        {stage === "APPROVED" && (
          <p className={styles.msg}>{t("pages.applications.detail.msgApproved")}</p>
        )}
        {stage === "SHIPPED" && (
          <div>
            <div className={styles.tracking}>
              <div className={styles.trackingLabel}>
                {t("pages.applications.detail.trackingCarrier")}
              </div>
              <div className={styles.trackingValue}>
                {data.trackingCarrier ?? "—"}
              </div>
              <div className={styles.trackingLabel}>
                {t("pages.applications.detail.trackingNumber")}
              </div>
              <div className={styles.trackingValue}>
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className={styles.msg}>{t("pages.applications.detail.msgShipped")}</p>
          </div>
        )}

        {stage === "AWAITING_RECEIPT" && (
          <div>
            <div className={styles.tracking}>
              <div className={styles.trackingLabel}>
                {t("pages.applications.detail.trackingCarrier")}
              </div>
              <div className={styles.trackingValue}>
                {data.trackingCarrier ?? "—"}
              </div>
              <div className={styles.trackingLabel}>
                {t("pages.applications.detail.trackingNumber")}
              </div>
              <div className={styles.trackingValue}>
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className={styles.msg}>
              {t("pages.applications.detail.awaitingReceiptPrefix")}
              {data.postingPeriodDays}
              {t("pages.applications.detail.awaitingReceiptSuffix")}
            </p>
            <PrimaryButton onClick={() => setShowReceiptDialog(true)} disabled={receive.isPending}>
              {t("pages.applications.detail.actionConfirmReceipt")}
            </PrimaryButton>
          </div>
        )}

        {stage === "POSTING" && (
          <PostSubmitForm
            subType={data.subType}
            initial=""
            onSubmit={async (url) => {
              await post.mutateAsync({ subType: data.subType, url });
            }}
            submitting={post.isPending}
            postingDeadlineAt={data.postingDeadlineAt}
          />
        )}

        {stage === "POST_REJECTED" &&
          data.posts
            .filter((p) => p.reviewStatus === "REJECTED")
            .map((p) => (
              <div key={p.id} className={styles.reject}>
                <div className={styles.rejectHead}>
                  <span className={styles.rejectBadge}>
                    {t("pages.applications.detail.rejectBadge")}
                  </span>
                  <span className={styles.rejectSns}>{p.subType}</span>
                </div>
                <div className={styles.rejectUrl}>
                  {t("pages.applications.detail.rejectUrlPrefix")}
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>
                </div>
                {p.lastRejectionComment && (
                  <div className={styles.rejectComment}>
                    <div className={styles.rejectCommentLabel}>
                      {t("pages.applications.detail.adminComment")}
                    </div>
                    <p>{p.lastRejectionComment}</p>
                  </div>
                )}
                <PostSubmitForm
                  subType={p.subType}
                  initial={p.url}
                  onSubmit={async (url) => {
                    await post.mutateAsync({ subType: p.subType, url });
                  }}
                  submitting={post.isPending}
                  postingDeadlineAt={data.postingDeadlineAt}
                />
              </div>
            ))}

        {stage === "POSTED" && (
          <p className={styles.msg}>{t("pages.applications.detail.msgPosted")}</p>
        )}

        {stage === "INSIGHT_DUE" && data.posts[0] && (
          <InsightSubmitForm
            applicationId={data.id}
            subType={data.posts[0].subType}
            initial={
              data.posts[0].insightSubmittedAt
                ? {
                    likes: data.posts[0].insightLikes ?? 0,
                    comments: data.posts[0].insightComments ?? 0,
                    shares: data.posts[0].insightShares ?? 0,
                    reposts: data.posts[0].insightReposts ?? 0,
                    saves: data.posts[0].insightSaves ?? 0,
                    views: data.posts[0].insightViews ?? 0,
                    reach: data.posts[0].insightReach ?? 0,
                  }
                : null
            }
            onSubmit={async (input) => {
              await insight.mutateAsync({
                subType: data.posts[0]!.subType,
                input,
              });
            }}
            submitting={insight.isPending}
            postSubmittedAt={data.posts[0].submittedAt}
          />
        )}

        {stage === "AWAITING_ORDER" && (
          <OrderSubmitForm
            applicationId={data.id}
            onSubmit={async (orderNumber, receipts) => {
              await order.mutateAsync({ orderNumber, receipts });
            }}
            submitting={order.isPending}
          />
        )}

        {stage === "AWAITING_REVIEW" && (
          <ReviewSubmitForm
            applicationId={data.id}
            orderSubmittedAt={data.orderSubmittedAt ?? data.appliedAt}
            postingPeriodDays={data.postingPeriodDays}
            onSubmit={async (reviewUrl, screenshots) => {
              await review.mutateAsync({ reviewUrl, screenshots });
            }}
            submitting={review.isPending}
          />
        )}

        {stage === "REVIEW_PENDING" && (
          <div>
            {data.posts[0]?.url && (
              <div className={styles.rejectUrl}>
                {t("pages.applications.detail.rejectUrlPrefix")}
                <a href={data.posts[0].url} target="_blank" rel="noreferrer">
                  {data.posts[0].url}
                </a>
              </div>
            )}
            <p className={styles.msg}>
              {t("application.stage.reviewPending.description")}
            </p>
          </div>
        )}

        {stage === "REVIEW_REJECTED" && data.posts[0] && (
          <div className={styles.reject}>
            <div className={styles.rejectHead}>
              <span className={styles.rejectBadge}>
                {t("pages.applications.detail.rejectBadge")}
              </span>
              <span className={styles.rejectSns}>
                {t("application.stage.reviewRejected.heading")}
              </span>
            </div>
            <div className={styles.rejectUrl}>
              {t("pages.applications.detail.rejectUrlPrefix")}
              <a href={data.posts[0].url} target="_blank" rel="noreferrer">
                {data.posts[0].url}
              </a>
            </div>
            {data.posts[0].lastRejectionComment && (
              <div className={styles.rejectComment}>
                <div className={styles.rejectCommentLabel}>
                  {t("application.stage.reviewRejected.reasonLabel")}
                </div>
                <p>{data.posts[0].lastRejectionComment}</p>
              </div>
            )}
            <p className={styles.msg}>
              {t("application.stage.reviewRejected.description")}
            </p>
            <ReviewSubmitForm
              applicationId={data.id}
              orderSubmittedAt={data.orderSubmittedAt ?? data.appliedAt}
              postingPeriodDays={data.postingPeriodDays}
              onSubmit={async (reviewUrl, screenshots) => {
                await review.mutateAsync({ reviewUrl, screenshots });
              }}
              submitting={review.isPending}
            />
          </div>
        )}

        {stage === "REVIEWING" && (
          <p className={styles.msg}>{t("pages.applications.detail.msgReviewing")}</p>
        )}

        {stage === "COMPLETED" && (
          <p className={styles.msg}>{t("pages.applications.detail.msgCompleted")}</p>
        )}

        {stage === "SETTLED" && data.settlement && (
          <div className={styles.thanks}>
            <p className={styles.thanksTitle}>
              {t("pages.applications.detail.thanksTitle")}
            </p>
            <dl className={styles.thanksMeta}>
              <div>
                <dt>{t("pages.applications.detail.labelReward")}</dt>
                <dd>
                  ¥{data.settlement.amountJpy.toLocaleString("ja-JP")}
                  {t("pages.applications.detail.yenSuffix")}
                </dd>
              </div>
              <div>
                <dt>{t("pages.applications.detail.labelPayer")}</dt>
                <dd>{t("pages.applications.detail.companyName")}</dd>
              </div>
            </dl>
          </div>
        )}

        {stage === "REJECTED" && (
          <p className={`${styles.msg} ${styles.msgErr}`}>
            {t("pages.applications.detail.rejectPrefix")}
            {data.rejectReason ?? "—"}
          </p>
        )}
        {stage === "CANCELLED" && (
          <p className={`${styles.msg} ${styles.msgErr}`}>
            {t("pages.applications.detail.cancelledNotice")}
          </p>
        )}

        {canCancel && (
          <button
            type="button"
            className={styles.cancel}
            disabled={cancel.isPending}
            onClick={() => setShowCancelDialog(true)}
          >
            {t("pages.applications.detail.actionCancel")}
          </button>
        )}
      </div>
      {showReceiptDialog && (
        <ReceiptConfirmDialog
          postingPeriodDays={data.postingPeriodDays}
          submitting={receive.isPending}
          onConfirm={() => receive.mutate()}
          onCancel={() => setShowReceiptDialog(false)}
        />
      )}
      {showCancelDialog && (
        <CancelConfirmDialog
          submitting={cancel.isPending}
          onConfirm={() => {
            cancel.mutate(undefined, {
              onSettled: () => setShowCancelDialog(false),
            });
          }}
          onCancel={() => setShowCancelDialog(false)}
        />
      )}
    </div>
  );
}
