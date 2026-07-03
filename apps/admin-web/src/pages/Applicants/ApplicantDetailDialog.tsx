import { useEffect, useState } from "react";
import type { Attachment } from "@jsure/shared";
import { SUB_TYPE_LABEL } from "@jsure/shared";
import {
  fetchApplicationAttachments,
  type Applicant,
} from "@/domains/application";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import styles from "./ApplicantDetailDialog.module.css";

type AttachmentsState =
  | { kind: "loading" }
  | { kind: "ready"; items: Attachment[] }
  | { kind: "error"; message: string };

type Props = {
  applicant: Applicant;
  onClose: () => void;
};

export function ApplicantDetailDialog({ applicant, onClose }: Props) {
  const [attachmentsState, setAttachmentsState] = useState<AttachmentsState>({
    kind: "loading",
  });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAttachmentsState({ kind: "loading" });
    fetchApplicationAttachments(applicant.id)
      .then((items) => {
        if (!cancelled) setAttachmentsState({ kind: "ready", items });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAttachmentsState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "첨부 이미지를 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [applicant.id]);

  const isFakePurchase = applicant.category === "FAKE_PURCHASE";
  const orderReceipts =
    attachmentsState.kind === "ready"
      ? attachmentsState.items.filter((item) => item.kind === "ORDER_RECEIPT")
      : [];
  const reviewScreenshots =
    attachmentsState.kind === "ready"
      ? attachmentsState.items.filter(
          (item) => item.kind === "REVIEW_SCREENSHOT",
        )
      : [];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} role="presentation">
        <div
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <header className={styles.header}>
            <div>
              <div className={styles.title}>{applicant.name} 상세</div>
              <div className={styles.sub}>
                {applicant.campaign} · {CATEGORY_LABEL_KO[applicant.category]} ·{" "}
                {SUB_TYPE_LABEL[applicant.subType]}
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

          {isFakePurchase ? (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>주문 정보</h3>
                <div className={styles.fields}>
                  <div className={styles.fieldLabel}>주문번호</div>
                  <div className={styles.fieldValue}>
                    {applicant.orderNumber ?? "—"}
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  주문 명세서
                  {orderReceipts.length > 0 && (
                    <span className={styles.count}>{orderReceipts.length}</span>
                  )}
                </h3>
                {renderAttachmentGrid(
                  attachmentsState,
                  orderReceipts,
                  setLightboxUrl,
                  "명세서가 아직 제출되지 않았습니다.",
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  리뷰 스크린샷
                  {reviewScreenshots.length > 0 && (
                    <span className={styles.count}>
                      {reviewScreenshots.length}
                    </span>
                  )}
                </h3>
                {renderAttachmentGrid(
                  attachmentsState,
                  reviewScreenshots,
                  setLightboxUrl,
                  "리뷰가 아직 제출되지 않았습니다.",
                )}
              </section>
            </>
          ) : (
            <section className={styles.section}>
              <div className={styles.empty}>
                SNS 응모는 상세 정보가 없습니다.
              </div>
            </section>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxUrl(null)}
          role="presentation"
        >
          <img src={lightboxUrl} alt="" />
        </div>
      )}
    </>
  );
}

function renderAttachmentGrid(
  state: AttachmentsState,
  items: Attachment[],
  onOpen: (url: string) => void,
  emptyMessage: string,
) {
  if (state.kind === "loading") {
    return <div className={styles.empty}>불러오는 중…</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.empty}>{state.message}</div>;
  }
  if (items.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }
  return (
    <div className={styles.grid}>
      {items.map((attachment) => (
        <button
          type="button"
          key={attachment.id}
          className={styles.tile}
          onClick={() => attachment.viewUrl && onOpen(attachment.viewUrl)}
          disabled={!attachment.viewUrl}
        >
          {attachment.viewUrl && <img src={attachment.viewUrl} alt="" />}
        </button>
      ))}
    </div>
  );
}
