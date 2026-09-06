import { useState } from "react";
import { JwinAccountStatusBadge } from "@/components/composites";
import { ScrollTable } from "@/components/composites";
import { Button, IconButton } from "@/components/ui";
import { useT } from "@/lib/i18n";
import type { JwinBrandAccountRow } from "./jwinBrandAccountTransform";
import styles from "./JwinBrandAccountTable.module.css";

type Props = {
  accounts: JwinBrandAccountRow[];
  /** 클립보드 복사 성공 여부를 반환한다(실패 시 false). */
  onCopyLink: (url: string) => Promise<boolean>;
  onEdit: (account: JwinBrandAccountRow) => void;
};

export function JwinBrandAccountTable({ accounts, onCopyLink, onEdit }: Props) {
  const t = useT();

  if (accounts.length === 0) {
    return <div className={styles.empty}>{t("jwin.account.empty")}</div>;
  }

  return (
    <ScrollTable minWidth={720}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("jwin.account.columns.label")}</th>
            <th>{t("jwin.account.slug")}</th>
            <th>{t("jwin.account.columns.account")}</th>
            <th>{t("jwin.account.columns.status")}</th>
            <th className={styles.num}>{t("jwin.account.columns.campaignCount")}</th>
            <th>{t("jwin.account.columns.connectLink")}</th>
            <th className={styles.num}>{t("jwin.campaign.columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <CopyLinkRow
              key={account.id}
              account={account}
              onCopyLink={onCopyLink}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

type CopyState = "idle" | "copied" | "failed";

function CopyLinkRow({
  account,
  onCopyLink,
  onEdit,
}: {
  account: JwinBrandAccountRow;
  onCopyLink: (url: string) => Promise<boolean>;
  onEdit: (account: JwinBrandAccountRow) => void;
}) {
  const t = useT();
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    const succeeded = await onCopyLink(account.connectUrl);
    setCopyState(succeeded ? "copied" : "failed");
    if (succeeded) window.setTimeout(() => setCopyState("idle"), 1500);
  };

  return (
    <tr className={styles.row}>
      <td className={styles.label}>{account.label}</td>
      <td className={styles.mono}>{account.slug}</td>
      <td className={account.xUsername ? styles.mono : styles.muted}>
        {account.xUsername ? `@${account.xUsername}` : t("jwin.account.notApproved")}
      </td>
      <td>
        <JwinAccountStatusBadge status={account.status} />
      </td>
      <td className={styles.num}>{account.campaignCount}</td>
      <td>
        <div className={styles.copyCell}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            iconLeft={<i className="fa-solid fa-link" aria-hidden="true" />}
          >
            {copyState === "copied" ? t("jwin.common.copied") : t("jwin.account.copyLink")}
          </Button>
          {copyState === "failed" && (
            <div className={styles.copyError}>
              {t("jwin.account.copyFailedBelow")}
              <div className={styles.linkText}>{account.connectUrl}</div>
            </div>
          )}
        </div>
      </td>
      <td className={styles.num}>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={t("jwin.postTemplate.edit")}
          onClick={() => onEdit(account)}
        >
          <i className="fa-solid fa-pen" aria-hidden="true" />
        </IconButton>
      </td>
    </tr>
  );
}
