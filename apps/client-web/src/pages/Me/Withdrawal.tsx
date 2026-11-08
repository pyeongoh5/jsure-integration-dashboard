import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WITHDRAWAL_REASON_DETAIL_MAX,
  WITHDRAWAL_REASON_ORDER,
  type WithdrawalBlockingApplication,
  type WithdrawalReason,
} from "@jsure/shared";
import { fetchWithdrawalEligibility, requestWithdrawal } from "@/domains/me";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { t, type TranslationKey } from "@i18n";
import styles from "./Withdrawal.module.css";

const REASON_LABEL_KEY: Record<WithdrawalReason, TranslationKey> = {
  NOT_ENOUGH_CAMPAIGNS: "pages.me.withdrawal.reasonNotEnoughCampaigns",
  GUIDELINE_BURDEN: "pages.me.withdrawal.reasonGuidelineBurden",
  REWARD_UNSATISFIED: "pages.me.withdrawal.reasonRewardUnsatisfied",
  USING_OTHER_PLATFORM: "pages.me.withdrawal.reasonUsingOtherPlatform",
  SNS_INACTIVE: "pages.me.withdrawal.reasonSnsInactive",
  OTHER: "pages.me.withdrawal.reasonOther",
};

/** 서버가 code 로 구분해 주는 실패만 전용 문구를 쓴다. 나머지는 일반 문구. */
const ERROR_MESSAGE_KEY: Record<string, TranslationKey> = {
  ONGOING_CAMPAIGN: "pages.me.withdrawal.errorOngoing",
  WITHDRAWAL_ALREADY_PENDING: "pages.me.withdrawal.errorAlreadyPending",
};

function errorMessageOf(error: unknown): string {
  const code = (error as { response?: { data?: { code?: string } } })?.response
    ?.data?.code;
  const key = code ? ERROR_MESSAGE_KEY[code] : undefined;
  return t(key ?? "pages.me.withdrawal.errorGeneric");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function MeWithdrawal() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["me", "withdrawal"],
    queryFn: fetchWithdrawalEligibility,
  });

  const [reason, setReason] = useState<WithdrawalReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: requestWithdrawal,
    onSuccess: () => {
      // 마이페이지의 "승인 대기중" 표시도 같이 갱신되어야 한다.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: unknown) => setServerError(errorMessageOf(error)),
  });

  function submit() {
    setServerError(null);
    if (!reason) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    mutation.mutate({ reason, reasonDetail });
  }

  if (isPending || !data) {
    return (
      <>
        <PageHeader showBack title={t("pages.me.withdrawal.title")} />
        <div className={styles.state}>{t("pages.me.withdrawal.loading")}</div>
      </>
    );
  }

  const latest = data.latest;

  return (
    <>
      <PageHeader showBack title={t("pages.me.withdrawal.title")} />
      <div className={styles.body}>
        {latest?.decision === "PENDING" ? (
          <PendingCard requestedAt={latest.requestedAt} />
        ) : (
          <>
            {latest?.decision === "REJECTED" && (
              <RejectedCard rejectReason={latest.rejectReason} />
            )}

            {data.blockingApplications.length > 0 ? (
              <BlockedCard applications={data.blockingApplications} />
            ) : (
              <>
                <NoticeCard autoCancelCount={data.autoCancelApplications.length} />

                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    {t("pages.me.withdrawal.reasonTitle")}
                    <span className={styles.required}>
                      {t("pages.me.withdrawal.reasonRequiredMark")}
                    </span>
                  </div>
                  <div className={styles.reasons}>
                    {WITHDRAWAL_REASON_ORDER.map((option) => (
                      <label key={option} className={styles.reason}>
                        <input
                          type="radio"
                          name="withdrawalReason"
                          value={option}
                          checked={reason === option}
                          onChange={() => {
                            setReason(option);
                            setReasonError(false);
                          }}
                        />
                        <span>{t(REASON_LABEL_KEY[option])}</span>
                      </label>
                    ))}
                  </div>
                  {reasonError && (
                    <div className={styles.fieldError}>
                      {t("pages.me.withdrawal.reasonRequiredError")}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    {t("pages.me.withdrawal.detailLabel")}
                  </div>
                  <textarea
                    className={styles.detail}
                    value={reasonDetail}
                    maxLength={WITHDRAWAL_REASON_DETAIL_MAX}
                    placeholder={t("pages.me.withdrawal.detailPlaceholder")}
                    onChange={(event) => setReasonDetail(event.target.value)}
                  />
                  <div className={styles.counter}>
                    {reasonDetail.length} / {WITHDRAWAL_REASON_DETAIL_MAX}
                  </div>
                </div>

                {serverError && <ErrorBanner message={serverError} />}

                <PrimaryButton
                  type="button"
                  onClick={submit}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? t("pages.me.withdrawal.submitting")
                    : t("pages.me.withdrawal.submit")}
                </PrimaryButton>
              </>
            )}
          </>
        )}

        <PrimaryButton variant="ghost" type="button" onClick={() => nav("/me")}>
          {t("pages.me.withdrawal.back")}
        </PrimaryButton>
      </div>
    </>
  );
}

function NoticeCard({ autoCancelCount }: { autoCancelCount: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        {t("pages.me.withdrawal.noticeTitle")}
      </div>
      <ul className={styles.noticeList}>
        <li>{t("pages.me.withdrawal.noticeApproval")}</li>
        <li>{t("pages.me.withdrawal.noticeRewards")}</li>
        <li>{t("pages.me.withdrawal.noticeOngoing")}</li>
        {autoCancelCount > 0 && (
          <li>
            {t("pages.me.withdrawal.noticeAutoCancelPrefix")}
            {autoCancelCount}
            {t("pages.me.withdrawal.noticeAutoCancelSuffix")}
          </li>
        )}
      </ul>
    </div>
  );
}

function BlockedCard({
  applications,
}: {
  applications: WithdrawalBlockingApplication[];
}) {
  return (
    <div className={`${styles.card} ${styles.blocked}`}>
      <div className={styles.cardTitle}>
        {t("pages.me.withdrawal.blockedTitle")}
      </div>
      <div className={styles.blockedText}>
        {t("pages.me.withdrawal.blockedDescription")}
      </div>
      <ul className={styles.campaignList}>
        {applications.map((application) => (
          <li key={application.applicationId}>{application.campaignTitle}</li>
        ))}
      </ul>
    </div>
  );
}

function PendingCard({ requestedAt }: { requestedAt: string }) {
  return (
    <div className={`${styles.card} ${styles.pending}`}>
      <div className={styles.cardTitle}>
        {t("pages.me.withdrawal.pendingTitle")}
      </div>
      <div className={styles.pendingText}>
        {t("pages.me.withdrawal.pendingDescription")}
      </div>
      <div className={styles.metaRow}>
        <span className={styles.metaLabel}>
          {t("pages.me.withdrawal.pendingRequestedAtLabel")}
        </span>
        {formatDateTime(requestedAt)}
      </div>
    </div>
  );
}

function RejectedCard({ rejectReason }: { rejectReason: string | null }) {
  return (
    <div className={`${styles.card} ${styles.rejected}`}>
      <div className={styles.cardTitle}>
        {t("pages.me.withdrawal.rejectedTitle")}
      </div>
      {rejectReason && (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>
            {t("pages.me.withdrawal.rejectedReasonLabel")}
          </span>
          {rejectReason}
        </div>
      )}
      <div className={styles.metaRow}>
        {t("pages.me.withdrawal.rejectedRetry")}
      </div>
    </div>
  );
}
