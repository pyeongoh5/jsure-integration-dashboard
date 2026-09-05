import { useEffect, useState } from "react";
import type { InfluencerNotesResponse } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { SegmentedTabs } from "@/components/composites";
import {
  createInfluencerMemo,
  fetchInfluencerNotes,
  flagInfluencer,
  unflagInfluencer,
} from "../api";
import { formatDateTime } from "../formatDateTime";
import { useT } from "@/lib/i18n";
import { InfluencerHistoryTab } from "./InfluencerHistoryTab";
import styles from "./InfluencerNotesDialog.module.css";

type NotesState =
  | { kind: "loading" }
  | { kind: "ready"; data: InfluencerNotesResponse }
  | { kind: "error"; message: string };

/** 수기 메모와 자동 집계 히스토리를 나누는 상단 탭. */
type DialogTab = "MEMO" | "HISTORY";

const DIALOG_TAB_LABEL: Record<DialogTab, AdminTranslationKey> = {
  MEMO: "domains.influencer.notesDialog.tabMemo",
  HISTORY: "domains.influencer.notesDialog.tabHistory",
};

const DIALOG_TAB_ORDER: DialogTab[] = ["MEMO", "HISTORY"];

type Props = {
  influencerId: string;
  influencerName: string;
  currentCampaignId?: string | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function InfluencerNotesDialog({
  influencerId,
  influencerName,
  currentCampaignId,
  onClose,
  onChanged,
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<DialogTab>("MEMO");
  const [state, setState] = useState<NotesState>({ kind: "loading" });
  const [memoDraft, setMemoDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchInfluencerNotes(influencerId)
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            cause instanceof Error
              ? cause.message
              : t("domains.influencer.notesDialog.loadFailed"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  async function handleSubmitMemo() {
    const trimmed = memoDraft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createInfluencerMemo(
        influencerId,
        trimmed,
        currentCampaignId ?? null,
      );
      setMemoDraft("");
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              data: { ...current.data, memos: [created, ...current.data.memos] },
            }
          : current,
      );
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("domains.influencer.notesDialog.memoSaveFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleFlag() {
    if (state.kind !== "ready") return;
    const currentlyFlagged = state.data.flaggedAt !== null;
    const confirmKey: AdminTranslationKey = currentlyFlagged
      ? "domains.influencer.notesDialog.unflagConfirm"
      : "domains.influencer.notesDialog.flagConfirm";
    const ok = window.confirm(t(confirmKey));
    if (!ok) return;
    setToggling(true);
    setError(null);
    try {
      if (currentlyFlagged) {
        await unflagInfluencer(influencerId);
        setState({
          kind: "ready",
          data: { ...state.data, flaggedAt: null },
        });
      } else {
        const result = await flagInfluencer(influencerId);
        setState({
          kind: "ready",
          data: { ...state.data, flaggedAt: result.flaggedAt },
        });
      }
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("domains.influencer.notesDialog.flagUpdateFailed"),
      );
    } finally {
      setToggling(false);
    }
  }

  const flagged = state.kind === "ready" && state.data.flaggedAt !== null;

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
            <div className={styles.title}>
              {t("domains.influencer.notesDialog.title", { name: influencerName })}
              {flagged && (
                <span className={styles.flaggedBadge}>
                  {t("domains.application.applicants.table.flagged")}
                </span>
              )}
            </div>
            <div className={styles.sub}>
              {t("domains.influencer.notesDialog.subtitle")}
            </div>
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

        {/* 대상외 지정은 탭과 무관한 인플루언서 단위 조작이라 탭 위에 둔다. */}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${flagged ? styles.toolbarBtnUnflag : styles.toolbarBtnDanger}`}
            onClick={handleToggleFlag}
            disabled={toggling || state.kind !== "ready"}
          >
            {flagged
              ? t("domains.influencer.notesDialog.unflag")
              : t("domains.influencer.notesDialog.flag")}
          </button>
        </div>

        <SegmentedTabs
          className={styles.mainTabs}
          items={DIALOG_TAB_ORDER.map((key) => ({
            key,
            label: t(DIALOG_TAB_LABEL[key]),
          }))}
          value={tab}
          onChange={setTab}
        />

        {error && <div className={styles.error}>{error}</div>}

        {tab === "MEMO" && (
          <MemoTab
            state={state}
            memoDraft={memoDraft}
            submitting={submitting}
            onMemoDraftChange={setMemoDraft}
            onSubmitMemo={handleSubmitMemo}
          />
        )}

        {tab === "HISTORY" && <InfluencerHistoryTab influencerId={influencerId} />}
      </div>
    </div>
  );
}

function MemoTab({
  state,
  memoDraft,
  submitting,
  onMemoDraftChange,
  onSubmitMemo,
}: {
  state: NotesState;
  memoDraft: string;
  submitting: boolean;
  onMemoDraftChange: (value: string) => void;
  onSubmitMemo: () => void;
}) {
  const t = useT();

  if (state.kind === "loading") {
    return <div className={styles.timelineEmpty}>{t("common.loading")}</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.error}>{state.message}</div>;
  }
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t("domains.influencer.notesDialog.addMemoTitle")}
        </h3>
        <div className={styles.memoForm}>
          <textarea
            className={styles.memoTextarea}
            value={memoDraft}
            onChange={(event) => onMemoDraftChange(event.target.value)}
            placeholder={t("domains.influencer.notesDialog.memoPlaceholder")}
            maxLength={2000}
          />
          <button
            type="button"
            className={styles.memoSubmit}
            onClick={onSubmitMemo}
            disabled={submitting || memoDraft.trim().length === 0}
          >
            {submitting
              ? t("domains.influencer.notesDialog.saving")
              : t("domains.influencer.notesDialog.addMemoTitle")}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t("domains.influencer.notesDialog.memoListTitle")}
        </h3>
        {state.data.memos.length === 0 ? (
          <div className={styles.timelineEmpty}>
            {t("domains.influencer.notesDialog.memoEmpty")}
          </div>
        ) : (
          <div className={styles.timeline}>
            {state.data.memos.map((memo) => (
              <article key={memo.id} className={styles.entry}>
                <div className={styles.entryHeader}>
                  {memo.campaignTitle && (
                    <span className={styles.entryCampaign}>
                      {memo.campaignTitle}
                    </span>
                  )}
                  <span>{formatDateTime(memo.createdAt)}</span>
                  {memo.createdBy && (
                    <span className={styles.entryActor}>
                      {memo.createdBy.name ?? memo.createdBy.id}
                    </span>
                  )}
                </div>
                <div className={styles.entryBody}>{memo.comment}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
