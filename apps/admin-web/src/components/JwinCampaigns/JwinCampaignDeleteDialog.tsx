import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Checkbox } from "@/components/ui";
import {
  deleteCampaign,
  fetchCampaignDeleteImpact,
  jwinErrorMessage,
  type AdminCampaignDeleteImpact,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignDeleteDialog.module.css";

type ImpactState =
  | { kind: "loading" }
  | { kind: "ready"; impact: AdminCampaignDeleteImpact }
  | { kind: "error"; message: string };

type Props = {
  campaignId: string;
  brandName: string;
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * 캠페인 삭제 확인 — 함께 사라지는 데이터 건수를 먼저 조회해 보여준다.
 * 응모·당첨자·게시 이력이 남아 있으면 체크박스로 한 번 더 확인받는다.
 */
export function JwinCampaignDeleteDialog({
  campaignId,
  brandName,
  onClose,
  onDeleted,
}: Props) {
  const t = useT();
  const [state, setState] = useState<ImpactState>({ kind: "loading" });
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchCampaignDeleteImpact(campaignId)
      .then((impact) => {
        if (!cancelled) setState({ kind: "ready", impact });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: jwinErrorMessage(error, t("jwin.campaign.deleteDialog.impactFailed")),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  const impact = state.kind === "ready" ? state.impact : null;
  // 실제 운영 흔적이 남은 캠페인만 재확인 대상 — 경품·포스트만 있는 준비 단계는 단순 확인.
  const hasHistory =
    impact !== null &&
    (impact.entryCount > 0 || impact.winnerCount > 0 || impact.postedCount > 0);

  const lines = impact
    ? ([
        ["entries", impact.entryCount],
        ["winners", impact.winnerCount],
        ["posted", impact.postedCount],
        ["prizes", impact.prizeCount],
        ["templates", impact.postTemplateCount],
      ] as const
      ).filter(([, count]) => count > 0)
    : [];

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCampaign(campaignId);
      onDeleted();
    } catch (error: unknown) {
      setDeleteError(jwinErrorMessage(error, t("jwin.campaign.deleteDialog.failed")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      open
      tone="danger"
      busy={deleting}
      confirmDisabled={state.kind !== "ready" || (hasHistory && !acknowledged)}
      confirmLabel={t("jwin.campaign.delete")}
      title={t("jwin.campaign.deleteDialog.title", { brand: brandName })}
      subtitle={
        <span className={styles.body}>
          {state.kind === "loading" && <span>{t("jwin.common.loading")}</span>}
          {state.kind === "error" && <span className={styles.error}>{state.message}</span>}
          {impact && (
            <>
              <span>
                {lines.length === 0
                  ? t("jwin.campaign.deleteDialog.clean")
                  : t("jwin.campaign.deleteDialog.impactIntro")}
              </span>
              {lines.length > 0 && (
                <span className={styles.list}>
                  {lines.map(([key, count]) => (
                    <span key={key} className={styles.item}>
                      {t(`jwin.campaign.deleteDialog.${key}` as const, { count })}
                    </span>
                  ))}
                </span>
              )}
              {hasHistory && (
                <Checkbox
                  checked={acknowledged}
                  onChange={setAcknowledged}
                  disabled={deleting}
                  label={t("jwin.campaign.deleteDialog.acknowledge")}
                />
              )}
            </>
          )}
          {deleteError && <span className={styles.error}>{deleteError}</span>}
        </span>
      }
      onConfirm={() => void handleConfirm()}
      onCancel={onClose}
    />
  );
}
