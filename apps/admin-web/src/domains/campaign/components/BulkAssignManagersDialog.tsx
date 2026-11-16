import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { bulkAssignCampaignManagers } from "../api";
import { useAdminUserOptions } from "../useAdminUserOptions";
import { CampaignManagerPicker } from "./CampaignManagerPicker";
import styles from "./BulkAssignManagersDialog.module.css";

type Props = {
  campaignIds: string[];
  onDone: () => void;
  onCancel: () => void;
};

/**
 * 선택한 캠페인들의 담당자를 한 번에 교체(덮어쓰기)하는 다이얼로그.
 *
 * 선택한 담당자 상태는 여기서만 관리한다 — 부모는 campaignIds 와
 * onDone/onCancel 만 안다. 되돌릴 수 없는 파괴적 액션이라 저장 버튼을 눌러도
 * 바로 보내지 않고 ConfirmDialog 경고를 한 번 더 거친다.
 */
export function BulkAssignManagersDialog({ campaignIds, onDone, onCancel }: Props) {
  const t = useT();
  const { managers, error: optionsError } = useAdminUserOptions();
  // 열렸을 때 선택돼 있던 캠페인에 작용한다 — 부모의 selectedIds 가 이후
  // (예: Esc 로 선택 해제) 바뀌어도 다이얼로그가 가리키는 대상은 그대로다.
  const [targetCampaignIds] = useState(() => [...campaignIds]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = targetCampaignIds.length;

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bulkAssignCampaignManagers({
        campaignIds: targetCampaignIds,
        managerIds,
      });
      if (result.updatedCount !== count) {
        window.alert(
          t("pages.campaigns.bulkAssign.partialUpdate", {
            updated: result.updatedCount,
            requested: count,
          }),
        );
      }
      onDone();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("pages.campaigns.bulkAssign.failed"));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  // 경고 확인이 떠 있는 동안은 피커 다이얼로그를 가린다 — 중첩 모달을 만들지 않는다.
  if (confirming) {
    return (
      <ConfirmDialog
        open
        title={t("pages.campaigns.bulkAssign.confirmTitle")}
        subtitle={t("pages.campaigns.bulkAssign.confirmBody", { count })}
        confirmLabel={t("pages.campaigns.bulkAssign.submit")}
        tone="danger"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (busy) return;
          setConfirming(false);
        }}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={onCancel} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{t("pages.campaigns.bulkAssign.title")}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onCancel}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
        <p className={styles.subtitle}>
          {t("pages.campaigns.bulkAssign.subtitle", { count })}
        </p>

        <CampaignManagerPicker
          value={managerIds}
          onChange={setManagerIds}
          managers={managers}
          error={optionsError}
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => setConfirming(true)}
            disabled={optionsError !== null}
          >
            {t("pages.campaigns.bulkAssign.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
