import { useMemo, useRef, useState } from "react";
import type { AdminInfluencer, SnsAccountSubType } from "@jsure/shared";
import { RichTextEditor } from "@/components/composites/RichTextEditor/RichTextEditor";
import {
  RichTextImageUploadError,
  serializeRichTextHtml,
  startRichTextImageUpload,
} from "@/lib/richTextImages";
import { sendBroadcastMessage } from "../api";
import { notifyBroadcastStarted } from "../broadcastEvents";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./BroadcastDialog.module.css";
// SNS 칩 스타일은 인플루언서 페이지의 것을 그대로 재사용
import influencersStyles from "@/pages/Influencers/Influencers.module.css";

const SNS_ICON: Record<SnsAccountSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
};
const SNS_CLASS: Record<SnsAccountSubType, string | undefined> = {
  INSTAGRAM: influencersStyles.snsIg,
  TIKTOK: influencersStyles.snsTt,
  X: influencersStyles.snsX,
  YOUTUBE: influencersStyles.snsYt,
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(n);
}

type Props = {
  open: boolean;
  /** 모달이 열렸을 때의 후보 인플루언서 (페이지 필터 적용 후 목록). */
  candidates: AdminInfluencer[];
  onClose: () => void;
};

const BROADCAST_IMAGE_ENDPOINT = "/uploads/admin/notice-image/presign";

type HeroImage =
  | { kind: "none" }
  | { kind: "uploading"; previewUrl: string }
  | { kind: "ready"; previewUrl: string; objectKey: string }
  | { kind: "error"; previewUrl: string; message: string };

export function BroadcastDialog({ open, candidates, onClose }: Props) {
  const t = useT();
  const [contentHtml, setContentHtml] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [hero, setHero] = useState<HeroImage>({ kind: "none" });
  const heroFileRef = useRef<HTMLInputElement>(null);

  const pickHeroFile = (file: File) => {
    let handle;
    try {
      handle = startRichTextImageUpload(file, BROADCAST_IMAGE_ENDPOINT);
    } catch (caught) {
      const message =
        caught instanceof RichTextImageUploadError
          ? caught.message
          : t("components.richTextEditor.imageUploadFailed");
      window.alert(message);
      return;
    }
    const { previewUrl, done: uploadDone } = handle;
    setHero({ kind: "uploading", previewUrl });
    uploadDone
      .then((result) => {
        setHero({
          kind: "ready",
          previewUrl,
          objectKey: result.objectKey,
        });
      })
      .catch((caught: unknown) => {
        const message =
          caught instanceof RichTextImageUploadError
            ? caught.message
            : t("components.richTextEditor.imageUploadFailed");
        setHero({ kind: "error", previewUrl, message });
      });
  };

  const removeHero = () => {
    if (hero.kind !== "none") {
      URL.revokeObjectURL(hero.previewUrl);
    }
    setHero({ kind: "none" });
  };

  // 후보가 바뀌면 선택 상태에서 사라진 ID 제거
  const candidateIds = useMemo(() => new Set(candidates.map((c) => c.id)), [candidates]);
  const visibleSelected = useMemo(
    () => Array.from(selected).filter((id) => candidateIds.has(id)),
    [selected, candidateIds],
  );

  const allSelected = candidates.length > 0 && visibleSelected.length === candidates.length;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const close = () => {
    if (sending) return;
    setContentHtml("");
    setSelected(new Set());
    setError(null);
    setDone(null);
    if (hero.kind !== "none") URL.revokeObjectURL(hero.previewUrl);
    setHero({ kind: "none" });
    onClose();
  };

  const submit = async () => {
    setError(null);
    setDone(null);
    if (!contentHtml.trim() || contentHtml === "<p></p>") {
      setError(t("domains.broadcast.dialog.contentRequired"));
      return;
    }
    if (visibleSelected.length === 0) {
      setError(t("domains.broadcast.dialog.recipientsRequired"));
      return;
    }
    if (hero.kind === "uploading") {
      setError(t("domains.broadcast.dialog.imageUploading"));
      return;
    }
    if (hero.kind === "error") {
      setError(t("domains.broadcast.dialog.imageUploadErrorState"));
      return;
    }
    if (
      !window.confirm(
        t("domains.broadcast.dialog.confirmSend", { count: visibleSelected.length }),
      )
    ) {
      return;
    }
    setSending(true);
    try {
      await sendBroadcastMessage({
        influencerIds: visibleSelected,
        contentHtml: serializeRichTextHtml(contentHtml),
        heroImageR2Key: hero.kind === "ready" ? hero.objectKey : null,
      });
      notifyBroadcastStarted();
      // 즉시 모달 닫기. 진행률은 화면 우하단 Dock 에서 확인.
      setSending(false);
      close();
      return;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("domains.broadcast.dialog.sendFailed"),
      );
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{t("domains.broadcast.dialog.title")}</h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={close}
            disabled={sending}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <section className={styles.section}>
            <label className={styles.label}>{t("domains.broadcast.dialog.contentLabel")}</label>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              minHeight={200}
              disabled={sending}
            />
            <p className={styles.hint}>{t("domains.broadcast.dialog.flexHint")}</p>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>{t("domains.broadcast.dialog.heroLabel")}</label>
            {hero.kind === "none" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => heroFileRef.current?.click()}
                disabled={sending}
              >
                {t("domains.broadcast.dialog.selectImage")}
              </Button>
            ) : (
              <div className={styles.hero}>
                <img src={hero.previewUrl} alt="" className={styles.heroPreview} />
                <div className={styles.heroMeta}>
                  {hero.kind === "uploading" && (
                    <span className={styles.heroStatus}>
                      {t("domains.broadcast.dialog.uploading")}
                    </span>
                  )}
                  {hero.kind === "ready" && (
                    <span className={`${styles.heroStatus} ${styles.isReady}`}>
                      {t("domains.broadcast.dialog.uploadDone")}
                    </span>
                  )}
                  {hero.kind === "error" && (
                    <span className={`${styles.heroStatus} ${styles.isError}`}>{hero.message}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeHero}
                    disabled={sending}
                  >
                    {t("domains.broadcast.dialog.removeImage")}
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={heroFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) pickHeroFile(file);
                event.target.value = "";
              }}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.recipientsHead}>
              <label className={styles.label}>
                {t("domains.broadcast.dialog.recipientsLabel", {
                  selected: visibleSelected.length,
                  total: candidates.length,
                })}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                disabled={sending || candidates.length === 0}
              >
                {allSelected
                  ? t("domains.broadcast.dialog.deselectAll")
                  : t("domains.broadcast.dialog.selectAll")}
              </Button>
            </div>
            <div className={styles.recipientsList}>
              {candidates.length === 0 ? (
                <div className={styles.empty}>
                  {t("domains.broadcast.dialog.emptyCandidates")}
                </div>
              ) : (
                candidates.map((c) => {
                  const checked = selected.has(c.id);
                  return (
                    <label key={c.id} className={`${styles.recipient} ${checked ? styles.isChecked : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(c.id)}
                        disabled={sending}
                      />
                      <span className={styles.recipientName}>{c.name}</span>
                      <span className={styles.recipientEmail}>{c.email}</span>
                      <span className={styles.recipientSns}>
                        {c.snsAccounts.map((s) => (
                          <span
                            key={s.snsType}
                            className={`${influencersStyles.sns} ${SNS_CLASS[s.snsType]}`}
                            title={`@${s.handle}`}
                          >
                            <i className={SNS_ICON[s.snsType]} />
                            <span className={influencersStyles.snsCount}>
                              {formatFollowers(s.followerCount)}
                            </span>
                          </span>
                        ))}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          {error && <div className={styles.error}>{error}</div>}
          {done && <div className={styles.success}>{done}</div>}
        </div>

        <div className={styles.modalFoot}>
          <Button variant="secondary" size="md" onClick={close} disabled={sending}>
            {t("common.close")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={sending}
            loading={sending}
          >
            {sending
              ? t("domains.broadcast.dialog.sending")
              : t("domains.broadcast.dialog.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
