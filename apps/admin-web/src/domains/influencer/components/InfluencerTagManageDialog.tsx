import { useEffect, useState } from "react";
import type { InfluencerTag } from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { deleteInfluencerTag, listInfluencerTags } from "../api";
import styles from "./InfluencerTagManageDialog.module.css";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; tags: InfluencerTag[] }
  | { kind: "error"; message: string };

type Props = {
  onClose: () => void;
  /** 태그가 지워지면 목록의 태그 배지·필터가 낡으므로 호출부가 다시 읽는다. */
  onDeleted: () => void;
};

/**
 * 태그 마스터 관리 — 삭제 전용.
 *
 * 태그는 메모 팝업에서 라벨을 입력하면 서버가 자동 생성하는 구조라, 오타나
 * 폐기된 태그가 자동완성 후보에 영구히 남는다. 지우는 경로가 여기다.
 */
export function InfluencerTagManageDialog({ onClose, onDeleted }: Props) {
  const t = useT();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [pendingDelete, setPendingDelete] = useState<InfluencerTag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setState({ kind: "loading" });
    listInfluencerTags()
      .then((tags) => setState({ kind: "ready", tags }))
      .catch((loadError: unknown) =>
        setState({
          kind: "error",
          message:
            loadError instanceof Error
              ? loadError.message
              : t("domains.influencer.tagManage.loadFailed"),
        }),
      );
  }

  useEffect(load, []);

  async function confirmDelete() {
    if (!pendingDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInfluencerTag(pendingDelete.id);
      setPendingDelete(null);
      load();
      onDeleted();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t("domains.influencer.tagManage.deleteFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  // 삭제 확인이 떠 있는 동안은 목록 다이얼로그를 가린다 — 중첩 모달을 만들지 않는다.
  if (pendingDelete) {
    return (
      <ConfirmDialog
        open
        title={t("domains.influencer.tagManage.confirmTitle", {
          label: pendingDelete.label,
        })}
        subtitle={
          <>
            <div>
              {pendingDelete.assignedCount > 0
                ? t("domains.influencer.tagManage.confirmAssigned", {
                    count: String(pendingDelete.assignedCount),
                  })
                : t("domains.influencer.tagManage.confirmUnassigned")}
            </div>
            <div className={styles.warning}>
              {t("domains.influencer.tagManage.confirmIrreversible")}
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </>
        }
        confirmLabel={
          busy
            ? t("components.confirmDialog.processing")
            : t("common.delete")
        }
        cancelLabel={t("common.cancel")}
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.title}>
            {t("domains.influencer.tagManage.title")}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <div className={styles.hint}>
          {t("domains.influencer.tagManage.hint")}
        </div>

        {state.kind === "loading" && (
          <div className={styles.empty}>{t("common.loading")}</div>
        )}
        {state.kind === "error" && (
          <div className={styles.error}>{state.message}</div>
        )}
        {state.kind === "ready" && state.tags.length === 0 && (
          <div className={styles.empty}>
            {t("domains.influencer.tagManage.empty")}
          </div>
        )}
        {state.kind === "ready" && state.tags.length > 0 && (
          <ul className={styles.list}>
            {state.tags.map((tag) => (
              <li key={tag.id} className={styles.row}>
                <span className={styles.label}>{tag.label}</span>
                <span className={styles.count}>
                  {t("domains.influencer.tagManage.assignedCount", {
                    count: String(tag.assignedCount),
                  })}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPendingDelete(tag)}
                >
                  {t("common.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
