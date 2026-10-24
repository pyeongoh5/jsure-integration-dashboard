import { useState } from "react";
import { JwinStatusBadge } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import type { ActivationCheck } from "./activationChecklist";
import { PauseCampaignDialog } from "./PauseCampaignDialog";
import { ResumeCampaignDialog } from "./ResumeCampaignDialog";
import { EndCampaignDialog } from "./EndCampaignDialog";
import type { JwinCampaignStatus } from "./useJwinStatusTransition";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminBrandCampaignDetail;
  checks: ActivationCheck[];
  changing: boolean;
  error: string | null;
  onChange: (status: JwinCampaignStatus) => void;
};

/**
 * 시작 조건 체크리스트 본문. 헤더(상태 배지 줄)의 토글로 펼치고 접는다 —
 * 접었을 때는 헤더 한 줄만 남는다.
 */
function ChecklistView({ checks }: { checks: ActivationCheck[] }) {
  const t = useT();
  return (
    <ul className={styles.checklist}>
      {checks.map((check) => (
        <li key={check.key} className={styles.checkItem}>
          <span
            className={[styles.checkMark, check.ok ? styles.checkOk : styles.checkFail].join(" ")}
          >
            {check.ok ? "✓" : "✗"}
          </span>
          <span>
            {t(check.labelKey)}
            {check.reasonKey && (
              <span className={styles.checkReason}>{t(check.reasonKey, check.reasonParams)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 상태 배지 + 전환 버튼. SETUP 에서는 발행 전 체크리스트만 보여준다 —
 * 캠페인 시작은 설정 화면이 아니라 시즌 상세에서 일괄 실행한다 (서버가 최종 검증).
 */
export function StatusTransition({ detail, checks, changing, error, onChange }: Props) {
  const t = useT();
  // 시작 전에는 펼쳐 두고, 이미 시작한 캠페인에서는 접어 둔다.
  const [checklistOpen, setChecklistOpen] = useState(detail.status === "SETUP");
  const passedCount = checks.filter((check) => check.ok).length;
  const allPassed = passedCount === checks.length;
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const confirm = (status: JwinCampaignStatus, close: () => void) => {
    close();
    onChange(status);
  };

  return (
    <div className={styles.transition}>
      <div className={styles.transitionHeader}>
        <JwinStatusBadge status={detail.status} />

        <button
          type="button"
          className={styles.checklistToggle}
          aria-expanded={checklistOpen}
          onClick={() => setChecklistOpen((current) => !current)}
        >
          <i
            className={`fa-solid fa-chevron-${checklistOpen ? "up" : "down"}`}
            aria-hidden="true"
          />
          <span>{t("jwin.status.checklistTitle")}</span>
          <span className={allPassed ? styles.checkOk : styles.checkFail}>
            {t("jwin.status.checklistCount", { passed: passedCount, total: checks.length })}
          </span>
        </button>

        <div className={styles.transitionButtons}>
          {detail.status === "SETUP" && (
            <span className={styles.fieldHint}>{t("jwin.status.startFromSeason")}</span>
          )}

          {detail.status === "ACTIVE" && (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPauseOpen(true)}
                disabled={changing}
              >
                {t("jwin.status.pause")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setEndOpen(true)}
                disabled={changing}
              >
                {t("jwin.status.end")}
              </Button>
            </>
          )}

          {detail.status === "PAUSED" && (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={() => setResumeOpen(true)}
                disabled={changing}
              >
                {t("jwin.status.resume")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setEndOpen(true)}
                disabled={changing}
              >
                {t("jwin.status.end")}
              </Button>
            </>
          )}
        </div>
      </div>

      {checklistOpen && <ChecklistView checks={checks} />}
      {error && <span className={styles.errorText}>{error}</span>}

      <PauseCampaignDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onConfirm={() => confirm("PAUSED", () => setPauseOpen(false))}
        pending={changing}
      />
      <ResumeCampaignDialog
        open={resumeOpen}
        onClose={() => setResumeOpen(false)}
        onConfirm={() => confirm("ACTIVE", () => setResumeOpen(false))}
        pending={changing}
      />
      <EndCampaignDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => confirm("ENDED", () => setEndOpen(false))}
        pending={changing}
      />
    </div>
  );
}
