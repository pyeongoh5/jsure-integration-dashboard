import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SnsType } from "@jsure/shared";
import { useState } from "react";
import {
  ApplicationStepper,
  CancelConfirmDialog,
  InsightSubmitForm,
  PostSubmitForm,
  ReceiptConfirmDialog,
  StageBadge,
  cancelApplication,
  confirmReceipt,
  submitInsight,
  submitPost,
  useApplication,
} from "@/domains/application";
import { PageHeader } from "@/components/composites/PageHeader";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
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
    mutationFn: ({ snsType, url }: { snsType: SnsType; url: string }) =>
      submitPost(id, snsType, url),
    onSuccess: () => invalidate(),
  });
  const insight = useMutation({
    mutationFn: ({
      snsType,
      input,
    }: {
      snsType: SnsType;
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
    }) => submitInsight(id, snsType, input),
    onSuccess: () => invalidate(),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.center}>読み込み中…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.center}>読み込みに失敗しました</div>
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
        {stage === "APPLIED" && <p className={styles.msg}>承認をお待ちください。</p>}
        {stage === "APPROVED" && <p className={styles.msg}>JSUREで発送準備中です。</p>}
        {stage === "SHIPPED" && (
          <div>
            <div className={styles.tracking}>
              <div className={styles.trackingLabel}>配送業者</div>
              <div className={styles.trackingValue}>
                {data.trackingCarrier ?? "—"}
              </div>
              <div className={styles.trackingLabel}>運送番号</div>
              <div className={styles.trackingValue}>
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className={styles.msg}>配送状況を確認しています。</p>
          </div>
        )}

        {stage === "AWAITING_RECEIPT" && (
          <div>
            <div className={styles.tracking}>
              <div className={styles.trackingLabel}>配送業者</div>
              <div className={styles.trackingValue}>
                {data.trackingCarrier ?? "—"}
              </div>
              <div className={styles.trackingLabel}>運送番号</div>
              <div className={styles.trackingValue}>
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className={styles.msg}>
              商品が届きましたか？受領を確認すると投稿期間（{data.postingPeriodDays}
              日）が始まります。
            </p>
            <PrimaryButton onClick={() => setShowReceiptDialog(true)} disabled={receive.isPending}>
              受領を確認する
            </PrimaryButton>
          </div>
        )}

        {stage === "POSTING" && (
          <PostSubmitForm
            snsType={data.snsType}
            initial=""
            onSubmit={async (url) => {
              await post.mutateAsync({ snsType: data.snsType, url });
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
                  <span className={styles.rejectBadge}>差し戻し</span>
                  <span className={styles.rejectSns}>{p.snsType}</span>
                </div>
                <div className={styles.rejectUrl}>
                  提出URL:{" "}
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>
                </div>
                {p.lastRejectionComment && (
                  <div className={styles.rejectComment}>
                    <div className={styles.rejectCommentLabel}>
                      管理者コメント
                    </div>
                    <p>{p.lastRejectionComment}</p>
                  </div>
                )}
                <PostSubmitForm
                  snsType={p.snsType}
                  initial={p.url}
                  onSubmit={async (url) => {
                    await post.mutateAsync({ snsType: p.snsType, url });
                  }}
                  submitting={post.isPending}
                  postingDeadlineAt={data.postingDeadlineAt}
                />
              </div>
            ))}

        {stage === "POSTED" && (
          <p className={styles.msg}>
            投稿を確認しました。投稿から7日後にインサイトを提出してください。
          </p>
        )}

        {stage === "INSIGHT_DUE" && data.posts[0] && (
          <InsightSubmitForm
            applicationId={data.id}
            snsType={data.posts[0].snsType}
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
                snsType: data.posts[0]!.snsType,
                input,
              });
            }}
            submitting={insight.isPending}
            postSubmittedAt={data.posts[0].submittedAt}
          />
        )}

        {stage === "REVIEWING" && <p className={styles.msg}>ブランドが検査中です。</p>}

        {stage === "COMPLETED" && (
          <p className={styles.msg}>完了しました。振込予定をお待ちください。</p>
        )}

        {stage === "SETTLED" && data.settlement && (
          <div className={styles.thanks}>
            <p className={styles.thanksTitle}>
              キャンペーンにご参加いただきありがとうございます。
            </p>
            <dl className={styles.thanksMeta}>
              <div>
                <dt>報酬</dt>
                <dd>¥{data.settlement.amountJpy.toLocaleString("ja-JP")}円</dd>
              </div>
              <div>
                <dt>振込人</dt>
                <dd>株式会社J-SURE</dd>
              </div>
            </dl>
          </div>
        )}

        {stage === "REJECTED" && (
          <p className={`${styles.msg} ${styles.msgErr}`}>
            未選定となりました: {data.rejectReason ?? "—"}
          </p>
        )}
        {stage === "CANCELLED" && (
          <p className={`${styles.msg} ${styles.msgErr}`}>
            キャンセル済（同じキャンペーンに再応募はできません）
          </p>
        )}

        {canCancel && (
          <button
            type="button"
            className={styles.cancel}
            disabled={cancel.isPending}
            onClick={() => setShowCancelDialog(true)}
          >
            応募をキャンセル
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
