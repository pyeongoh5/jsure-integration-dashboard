import type { WithdrawalDecision } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import styles from "./WithdrawalBadge.module.css";

/** 목록 배지·CSV·다이얼로그가 같은 라벨을 쓰도록 매핑은 여기 한 곳에만 둔다. */
export const WITHDRAWAL_DECISION_LABEL_KEY: Record<
  WithdrawalDecision,
  AdminTranslationKey
> = {
  PENDING: "domains.influencer.withdrawal.statusPending",
  APPROVED: "domains.influencer.withdrawal.statusApproved",
  REJECTED: "domains.influencer.withdrawal.statusRejected",
};

const BADGE_CLASS: Partial<Record<WithdrawalDecision, string>> = {
  PENDING: styles.pending,
  APPROVED: styles.approved,
  REJECTED: styles.rejected,
};

type Props = {
  decision: WithdrawalDecision;
  /** 툴팁에 덧붙일 신청 내용(사유·신청일시 등). 승인 권한이 없는 매니저도 읽을 수 있어야 한다. */
  detail?: string;
};

export function WithdrawalBadge({ decision, detail }: Props) {
  const t = useT();
  const label = t(WITHDRAWAL_DECISION_LABEL_KEY[decision]);
  return (
    <span
      className={`${styles.badge} ${BADGE_CLASS[decision] ?? ""}`}
      title={detail ? `${label}\n${detail}` : label}
    >
      {label}
    </span>
  );
}
