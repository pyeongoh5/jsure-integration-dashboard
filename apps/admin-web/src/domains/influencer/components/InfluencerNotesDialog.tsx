import { useEffect, useMemo, useState } from "react";
import type { InfluencerNotesResponse } from "@jsure/shared";
import {
  createInfluencerMemo,
  fetchInfluencerNotes,
  flagInfluencer,
  unflagInfluencer,
} from "../api";
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
    }
  | {
      kind: "application";
      id: string;
      at: string;
      comment: string;
      campaignTitle: string;
    }
  | {
      kind: "post";
      id: string;
      at: string;
      comment: string;
      campaignTitle: string;
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
    });
  }
  for (const rejection of data.postRejections) {
    entries.push({
      kind: "post",
      id: rejection.id,
      at: rejection.rejectedAt,
      comment: rejection.comment,
      campaignTitle: rejection.campaignTitle,
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
              : "노트를 불러올 수 없습니다.",
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
        cause instanceof Error ? cause.message : "메모를 저장할 수 없습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleFlag() {
    if (state.kind !== "ready") return;
    const currentlyFlagged = state.data.flaggedAt !== null;
    const ok = window.confirm(
      currentlyFlagged ? "대상외 지정을 해제하시겠습니까?" : "이 인플루언서를 대상외로 지정하시겠습니까?",
    );
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
          : "대상외 설정을 변경할 수 없습니다.",
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
              {influencerName} 메모/히스토리
              {flagged && <span className={styles.flaggedBadge}>대상외</span>}
            </div>
            <div className={styles.sub}>
              인플루언서 단위로 메모와 응모/투고 반려 이력을 확인합니다.
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

        {state.kind === "loading" && (
          <div className={styles.timelineEmpty}>불러오는 중…</div>
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
                {flagged ? "대상외 해제" : "대상외 지정"}
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>메모 추가</h3>
              <div className={styles.memoForm}>
                <textarea
                  className={styles.memoTextarea}
                  value={memoDraft}
                  onChange={(event) => setMemoDraft(event.target.value)}
                  placeholder="이 인플루언서에 대한 메모를 입력하세요."
                  maxLength={2000}
                />
                <button
                  type="button"
                  className={styles.memoSubmit}
                  onClick={handleSubmitMemo}
                  disabled={submitting || memoDraft.trim().length === 0}
                >
                  {submitting ? "저장 중…" : "메모 추가"}
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>히스토리</h3>
              {timeline.length === 0 ? (
                <div className={styles.timelineEmpty}>
                  기록된 메모/반려 이력이 없습니다.
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
                          className={`${styles.entryChip} ${
                            entry.kind === "memo"
                              ? styles.entryChipMemo
                              : entry.kind === "application"
                                ? styles.entryChipApp
                                : styles.entryChipPost
                          }`}
                        >
                          {entry.kind === "memo"
                            ? "메모"
                            : entry.kind === "application"
                              ? "응모 반려"
                              : "투고 반려"}
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
