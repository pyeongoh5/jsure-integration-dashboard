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
          : "이미지 업로드에 실패했습니다";
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
            : "이미지 업로드에 실패했습니다";
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
      setError("내용을 입력해 주세요");
      return;
    }
    if (visibleSelected.length === 0) {
      setError("수신자를 1명 이상 선택해 주세요");
      return;
    }
    if (hero.kind === "uploading") {
      setError("이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요");
      return;
    }
    if (hero.kind === "error") {
      setError("이미지 업로드 실패 상태입니다. 이미지를 다시 선택하거나 제거해 주세요");
      return;
    }
    if (
      !window.confirm(
        `${visibleSelected.length}명에게 메시지를 발송할까요? 발송 후에는 되돌릴 수 없습니다.`,
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
      setError(err instanceof Error ? err.message : "발송 중 오류가 발생했습니다.");
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>메시지 발송</h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={close}
            disabled={sending}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <section className={styles.section}>
            <label className={styles.label}>메시지 내용</label>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              minHeight={200}
              disabled={sending}
            />
            <p className={styles.hint}>
              LINE Flex 메시지로 발송되며 인라인 굵기/색은 단순화될 수 있습니다.
            </p>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>상단 이미지 (선택, 1장)</label>
            {hero.kind === "none" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => heroFileRef.current?.click()}
                disabled={sending}
              >
                이미지 선택
              </Button>
            ) : (
              <div className={styles.hero}>
                <img src={hero.previewUrl} alt="" className={styles.heroPreview} />
                <div className={styles.heroMeta}>
                  {hero.kind === "uploading" && (
                    <span className={styles.heroStatus}>업로드 중…</span>
                  )}
                  {hero.kind === "ready" && (
                    <span className={`${styles.heroStatus} ${styles.isReady}`}>업로드 완료</span>
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
                    제거
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
                수신자 ({visibleSelected.length}/{candidates.length}명 선택)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                disabled={sending || candidates.length === 0}
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </Button>
            </div>
            <div className={styles.recipientsList}>
              {candidates.length === 0 ? (
                <div className={styles.empty}>표시할 인플루언서가 없습니다.</div>
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
            닫기
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={sending}
            loading={sending}
          >
            {sending ? "발송 중…" : "발송"}
          </Button>
        </div>
      </div>
    </div>
  );
}
