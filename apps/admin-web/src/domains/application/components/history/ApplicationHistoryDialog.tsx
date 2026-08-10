import { ActivityTimeline } from "./ActivityTimeline";
import { useApplicationActivity } from "./useApplicationActivity";
import styles from "./ApplicationHistoryDialog.module.css";

/**
 * 세 목록 페이지(응모자관리·검토·정산)가 공유하는 이력 다이얼로그의 입력.
 * 행 타입이 페이지마다 달라 정규화된 값만 받는다 — 매핑은 각 페이지가 한다.
 */
export type HistoryTarget = {
  applicationId: string;
  campaignTitle: string;
  influencerName: string;
  /** 페이지가 자기 라벨맵으로 이미 변환한 현재 상태 표시값. */
  statusLabel: string;
};

type Props = {
  target: HistoryTarget;
  onClose: () => void;
};

export function ApplicationHistoryDialog({ target, onClose }: Props) {
  const { state } = useApplicationActivity(target.applicationId);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{target.campaignTitle}</h2>
            <div className={styles.sub}>
              {/* 담당자 컬럼과 같은 이름이 나올 수 있어 무엇의 이름인지 밝힌다. */}
              <span className={styles.subLabel}>인플루언서</span>
              {target.influencerName}
              <span className={styles.statusBadge}>{target.statusLabel}</span>
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
        <ActivityTimeline state={state} />
      </div>
    </div>
  );
}
