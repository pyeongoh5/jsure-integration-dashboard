import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfluencerApplication, SnsType } from "@jsure/shared";
import {
  cancelApplication,
  confirmDelivery,
  getApplication,
  submitInsight,
  submitPost,
} from "../../lib/api/applications";
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
  }

  const cancel = useMutation({
    mutationFn: () => cancelApplication(id),
    onSuccess: () => invalidate(),
  });
  const deliver = useMutation({
    mutationFn: () => confirmDelivery(id),
    onSuccess: () => invalidate(),
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
      input: { saves: number; reach: number; profileViews: number };
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
  const canCancel =
    data.status === "APPLIED" ||
    data.status === "APPROVED" ||
    data.status === "SHIPPED";

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
        <div className="adetail__reward">
          ¥{data.rewardJpy.toLocaleString("ja-JP")}
        </div>
        <div className="adetail__stepper">
          <ApplicationStepper stage={stage} />
        </div>
      </div>

      <div className="adetail__sections">
        {stage === "APPLIED" && (
          <p className="adetail__msg">承認をお待ちください。</p>
        )}
        {stage === "APPROVED" && (
          <p className="adetail__msg">発送準備中です。</p>
        )}
        {stage === "SHIPPED" && (
          <div>
            <div className="adetail__tracking">
              <div className="adetail__tracking-label">運送番号</div>
              <div className="adetail__tracking-value">
                {data.trackingNumber ?? "—"}
              </div>
            </div>
            <PrimaryButton
              onClick={() => deliver.mutate()}
              disabled={deliver.isPending}
            >
              {deliver.isPending ? "送信中…" : "受取完了を報告"}
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

        {stage === "POSTED" && (
          <p className="adetail__msg">
            投稿を確認しました。投稿から7日後にインサイトを提出してください。
          </p>
        )}

        {stage === "INSIGHT_DUE" && data.posts[0] && (
          <InsightSubmitForm
            initial={
              data.posts[0].insightSubmittedAt
                ? {
                    saves: data.posts[0].insightSaves ?? 0,
                    reach: data.posts[0].insightReach ?? 0,
                    profileViews: data.posts[0].insightProfileViews ?? 0,
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

        {stage === "REVIEWING" && (
          <p className="adetail__msg">ブランドが検査中です。</p>
        )}

        {stage === "COMPLETED" && (
          <p className="adetail__msg">完了しました。振込予定をお待ちください。</p>
        )}

        {stage === "REJECTED" && (
          <p className="adetail__msg adetail__msg--err">
            却下されました: {data.rejectReason ?? "—"}
          </p>
        )}
        {stage === "CANCELLED" && (
          <p className="adetail__msg adetail__msg--err">キャンセル済</p>
        )}

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
    </div>
  );
}
