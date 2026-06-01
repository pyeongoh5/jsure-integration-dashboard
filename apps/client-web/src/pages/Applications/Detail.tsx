import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfluencerApplication, SnsType } from "@jsure/shared";
import { useState } from "react";
import {
  cancelApplication,
  confirmReceipt,
  getApplication,
  submitInsight,
  submitPost,
} from "../../lib/api/applications";
import { ReceiptConfirmDialog } from "../../components/Application/ReceiptConfirmDialog";
import { PageHeader } from "../../components/layout/PageHeader";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { StageBadge } from "../../components/Application/StageBadge";
import { ApplicationStepper } from "../../components/Application/ApplicationStepper";
import { PostSubmitForm } from "../../components/Application/PostSubmitForm";
import { InsightSubmitForm } from "../../components/Application/InsightSubmitForm";
import "./ApplicationDetail.css";

function findPost(app: InfluencerApplication, snsType: SnsType) {
  return app.posts.find((p) => p.snsType === snsType) ?? null;
}

export function ApplicationDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id),
    enabled: !!id,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["application", id] });
    qc.invalidateQueries({ queryKey: ["applications"] });
    qc.invalidateQueries({ queryKey: ["influencer-campaign"] });
    qc.invalidateQueries({ queryKey: ["influencer-campaigns"] });
  }

  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  const cancel = useMutation({
    mutationFn: () => cancelApplication(id),
    onSuccess: () => invalidate(),
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
        <div className="adetail__center">読み込み中…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className="adetail__center">読み込みに失敗しました</div>
      </div>
    );
  }

  const stage = data.displayStage;
  const canCancel = data.status === "APPLIED";

  // Determine SNS types this application can post to (intersection — use
  // app.posts existing or campaign snsTypes via separate fetch). MVP: derive
  // from existing posts + add option for SNS not yet posted later.
  const sns = new Set<SnsType>(data.posts.map((p) => p.snsType));

  return (
    <div className="adetail">
      <PageHeader showBack title={data.campaignTitle} />
      <div className="adetail__top">
        <div className="adetail__head-row">
          <div className="adetail__title">{data.campaignTitle}</div>
          <StageBadge stage={stage} />
        </div>
        <div className="adetail__reward">¥{data.rewardJpy.toLocaleString("ja-JP")}</div>
        <div className="adetail__stepper">
          <ApplicationStepper stage={stage} />
        </div>
      </div>

      <div className="adetail__sections">
        {stage === "APPLIED" && <p className="adetail__msg">承認をお待ちください。</p>}
        {stage === "APPROVED" && <p className="adetail__msg">JSUREで発送準備中です。</p>}
        {stage === "SHIPPED" && (
          <div>
            <div className="adetail__tracking">
              <div className="adetail__tracking-label">配送業者</div>
              <div className="adetail__tracking-value">
                {data.trackingCarrier ?? "—"}
              </div>
              <div className="adetail__tracking-label">運送番号</div>
              <div className="adetail__tracking-value">
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className="adetail__msg">配送状況を確認しています。</p>
          </div>
        )}

        {stage === "AWAITING_RECEIPT" && (
          <div>
            <div className="adetail__tracking">
              <div className="adetail__tracking-label">配送業者</div>
              <div className="adetail__tracking-value">
                {data.trackingCarrier ?? "—"}
              </div>
              <div className="adetail__tracking-label">運送番号</div>
              <div className="adetail__tracking-value">
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <p className="adetail__msg">
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
            snsType={(Array.from(sns)[0] ?? "INSTAGRAM") as SnsType}
            initial=""
            onSubmit={async (url) => {
              const snsType: SnsType = "INSTAGRAM"; // MVP: default; refine later
              await post.mutateAsync({ snsType, url });
            }}
            submitting={post.isPending}
          />
        )}

        {stage === "POST_REJECTED" &&
          data.posts
            .filter((p) => p.reviewStatus === "REJECTED")
            .map((p) => (
              <div key={p.id} className="adetail__reject">
                <div className="adetail__reject-head">
                  <span className="adetail__reject-badge">差し戻し</span>
                  <span className="adetail__reject-sns">{p.snsType}</span>
                </div>
                <div className="adetail__reject-url">
                  提出URL:{" "}
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>
                </div>
                {p.lastRejectionComment && (
                  <div className="adetail__reject-comment">
                    <div className="adetail__reject-comment-label">
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
                />
              </div>
            ))}

        {stage === "POSTED" && (
          <p className="adetail__msg">
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
          />
        )}

        {stage === "REVIEWING" && <p className="adetail__msg">ブランドが検査中です。</p>}

        {stage === "COMPLETED" && (
          <p className="adetail__msg">完了しました。振込予定をお待ちください。</p>
        )}

        {stage === "REJECTED" && (
          <p className="adetail__msg adetail__msg--err">
            却下されました: {data.rejectReason ?? "—"}
          </p>
        )}
        {stage === "CANCELLED" && <p className="adetail__msg adetail__msg--err">キャンセル済</p>}

        {canCancel && (
          <button
            type="button"
            className="adetail__cancel"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm("本当にキャンセルしますか？")) cancel.mutate();
            }}
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
    </div>
  );
}
