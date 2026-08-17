import { useEffect, useState } from "react";
import type { Attachment } from "@jsure/shared";
import { SUB_TYPE_LABEL } from "@jsure/shared";
import {
  fetchApplicationAttachments,
  type Applicant,
} from "@/domains/application";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { translate } from "@i18n/admin";
import { getStoredLanguage, useT } from "@/lib/i18n";
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
  const t = useT();
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
              : translate(
                  "domains.application.drafts.insightDialog.attachmentsLoadFailed",
                  getStoredLanguage(),
                ),
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
              <div className={styles.title}>
                {t("pages.applicants.detailDialog.title", { name: applicant.name })}
              </div>
              <div className={styles.sub}>
                {applicant.campaign} · {t(CATEGORY_LABEL_KO[applicant.category])} ·{" "}
                {applicant.subTypes
                  .map((subType) => SUB_TYPE_LABEL[subType])
                  .join(" · ")}
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

          {isFakePurchase ? (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {t("domains.application.drafts.insightDialog.orderInfo")}
                </h3>
                <div className={styles.fields}>
                  <div className={styles.fieldLabel}>
                    {t("domains.application.drafts.insightDialog.orderNumber")}
                  </div>
                  <div className={styles.fieldValue}>
                    {applicant.orderNumber ?? "—"}
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {t("domains.application.drafts.insightDialog.orderReceipt")}
                  {orderReceipts.length > 0 && (
                    <span className={styles.count}>{orderReceipts.length}</span>
                  )}
                </h3>
                {renderAttachmentGrid(
                  attachmentsState,
                  orderReceipts,
                  setLightboxUrl,
                  t("domains.application.drafts.insightDialog.receiptNotSubmitted"),
                  t,
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {t("domains.application.drafts.insightDialog.reviewScreenshots")}
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
                  t("domains.application.drafts.insightDialog.reviewNotSubmitted"),
                  t,
                )}
              </section>
            </>
          ) : (
            <section className={styles.section}>
              <div className={styles.empty}>
                {t("pages.applicants.detailDialog.snsNoDetail")}
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
  t: ReturnType<typeof useT>,
) {
  if (state.kind === "loading") {
    return <div className={styles.empty}>{t("common.loading")}</div>;
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
