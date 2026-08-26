import { useState } from "react";
import { JwinStatusBadge } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { canActivate, type ActivationCheck } from "./activationChecklist";
import { PauseCampaignDialog } from "./PauseCampaignDialog";
import { ResumeCampaignDialog } from "./ResumeCampaignDialog";
import { EndCampaignDialog } from "./EndCampaignDialog";
import type { JwinCampaignStatus } from "./useJwinStatusTransition";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminCampaignDetail;
  checks: ActivationCheck[];
  changing: boolean;
  // 체크리스트가 참조하는 경품·소재 데이터가 재조회 중이면 ACTIVE 버튼을 잠가
  // 삭제 직후 stale 데이터로 체크리스트가 통과된 것처럼 보이는 창을 막는다.
  checksStale: boolean;
  error: string | null;
  onChange: (status: JwinCampaignStatus) => void;
};

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
 * 상태 배지 + 전환 버튼. SETUP 에서는 발행 전 체크리스트를 함께 보여주고,
 * 4항목을 전부 충족해야 ACTIVE 전환 버튼이 열린다.
 */
export function StatusTransition({ detail, checks, changing, checksStale, error, onChange }: Props) {
  const t = useT();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const confirm = (status: JwinCampaignStatus, close: () => void) => {
    close();
    onChange(status);
  };

  return (
    <div className={styles.transition}>
      <div className={styles.transitionButtons}>
        <JwinStatusBadge status={detail.status} />

        {detail.status === "SETUP" && (
          <Button
            variant="primary"
            size="md"
            onClick={() => onChange("ACTIVE")}
            disabled={changing || checksStale || !canActivate(checks)}
          >
            {changing ? t("jwin.status.changing") : t("jwin.status.start")}
          </Button>
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

      {detail.status === "SETUP" && <ChecklistView checks={checks} />}
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
