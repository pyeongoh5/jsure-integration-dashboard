import { useEffect, useMemo, useState } from "react";
import type { InfluencerNotesResponse } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import {
  createInfluencerMemo,
  fetchInfluencerNotes,
  flagInfluencer,
  unflagInfluencer,
} from "../api";
import { useT } from "@/lib/i18n";
import styles from "./InfluencerNotesDialog.module.css";

type NotesState =
  | { kind: "loading" }
  | { kind: "ready"; data: InfluencerNotesResponse }
  | { kind: "error"; message: string };

type TimelineEntry =
  | {
      kind: "memo";
      id: string;
      at: string;
      comment: string;
      campaignTitle: string | null;
      /** 메모 작성자 / 반려를 수행한 어드민. 계정 삭제 시 null. */
      actorName: string | null;
    }
  | {
      kind: "application";
      id: string;
      at: string;
      comment: string;
      campaignTitle: string;
      actorName: string | null;
    }
  | {
      kind: "post";
      id: string;
      at: string;
      comment: string;
      campaignTitle: string;
      actorName: string | null;
    };

function buildTimeline(data: InfluencerNotesResponse): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const memo of data.memos) {
    entries.push({
      kind: "memo",
      id: memo.id,
      at: memo.createdAt,
      comment: memo.comment,
      campaignTitle: memo.campaignTitle,
      actorName: memo.createdBy?.name ?? null,
    });
  }
  for (const rejection of data.applicationRejections) {
    if (!rejection.rejectedAt) continue;
    entries.push({
      kind: "application",
      id: rejection.applicationId,
      at: rejection.rejectedAt,
      comment: rejection.comment,
      campaignTitle: rejection.campaignTitle,
      actorName: rejection.rejectedBy?.name ?? null,
    });
  }
  for (const rejection of data.postRejections) {
    entries.push({
      kind: "post",
      id: rejection.id,
      at: rejection.rejectedAt,
      comment: rejection.comment,
      campaignTitle: rejection.campaignTitle,
      actorName: rejection.rejectedBy?.name ?? null,
    });
  }
  entries.sort((left, right) => (left.at < right.at ? 1 : -1));
  return entries;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const ENTRY_CHIP_CLASS: Record<TimelineEntry["kind"], string | undefined> = {
  memo: styles.entryChipMemo,
  application: styles.entryChipApp,
  post: styles.entryChipPost,
};

const ENTRY_CHIP_LABEL_KEY: Record<TimelineEntry["kind"], AdminTranslationKey> = {
  memo: "domains.influencer.notesDialog.chipMemo",
  application: "domains.influencer.notesDialog.chipApplicationRejection",
  post: "domains.influencer.notesDialog.chipPostRejection",
};

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

  const timeline = useMemo(
    () => (state.kind === "ready" ? buildTimeline(state.data) : []),
    [state],
  );

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

        {state.kind === "loading" && (
          <div className={styles.timelineEmpty}>{t("common.loading")}</div>
        )}

        {state.kind === "error" && (
          <div className={styles.error}>{state.message}</div>
        )}

        {state.kind === "ready" && (
          <>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={`${styles.toolbarBtn} ${flagged ? styles.toolbarBtnUnflag : styles.toolbarBtnDanger}`}
                onClick={handleToggleFlag}
                disabled={toggling}
              >
                {flagged
                  ? t("domains.influencer.notesDialog.unflag")
                  : t("domains.influencer.notesDialog.flag")}
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {t("domains.influencer.notesDialog.addMemoTitle")}
              </h3>
              <div className={styles.memoForm}>
                <textarea
                  className={styles.memoTextarea}
                  value={memoDraft}
                  onChange={(event) => setMemoDraft(event.target.value)}
                  placeholder={t("domains.influencer.notesDialog.memoPlaceholder")}
                  maxLength={2000}
                />
                <button
                  type="button"
                  className={styles.memoSubmit}
                  onClick={handleSubmitMemo}
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
                {t("domains.influencer.notesDialog.historyTitle")}
              </h3>
              {timeline.length === 0 ? (
                <div className={styles.timelineEmpty}>
                  {t("domains.influencer.notesDialog.historyEmpty")}
                </div>
              ) : (
                <div className={styles.timeline}>
                  {timeline.map((entry) => (
                    <article
                      key={`${entry.kind}-${entry.id}`}
                      className={styles.entry}
                    >
                      <div className={styles.entryHeader}>
                        <span
                          className={`${styles.entryChip} ${ENTRY_CHIP_CLASS[entry.kind]}`}
                        >
                          {t(ENTRY_CHIP_LABEL_KEY[entry.kind])}
                        </span>
                        {entry.kind !== "memo" && (
                          <span className={styles.entryCampaign}>
                            {entry.campaignTitle}
                          </span>
                        )}
                        {entry.kind === "memo" && entry.campaignTitle && (
                          <span className={styles.entryCampaign}>
                            {entry.campaignTitle}
                          </span>
                        )}
                        <span>{formatDateTime(entry.at)}</span>
                        {entry.actorName && (
                          <span className={styles.entryActor}>
                            {entry.actorName}
                          </span>
                        )}
                      </div>
                      <div className={styles.entryBody}>{entry.comment}</div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
