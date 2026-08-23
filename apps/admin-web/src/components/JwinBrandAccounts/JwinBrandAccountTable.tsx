import { useState } from "react";
import { JwinAccountStatusBadge } from "@/components/composites";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import type { JwinBrandAccountRow } from "./jwinBrandAccountTransform";
import styles from "./JwinBrandAccountTable.module.css";

type Props = {
  accounts: JwinBrandAccountRow[];
  /** 클립보드 복사 성공 여부를 반환한다(실패 시 false). */
  onCopyLink: (url: string) => Promise<boolean>;
};

export function JwinBrandAccountTable({ accounts, onCopyLink }: Props) {
  if (accounts.length === 0) {
    return <div className={styles.empty}>등록된 브랜드 계정이 없습니다.</div>;
  }

  return (
    <ScrollTable minWidth={720}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>라벨</th>
            <th>계정</th>
            <th>상태</th>
            <th className={styles.num}>사용 캠페인</th>
            <th>연동 링크</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <CopyLinkRow key={account.id} account={account} onCopyLink={onCopyLink} />
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
}: {
  account: JwinBrandAccountRow;
  onCopyLink: (url: string) => Promise<boolean>;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    const succeeded = await onCopyLink(account.connectUrl);
    setCopyState(succeeded ? "copied" : "failed");
    if (succeeded) window.setTimeout(() => setCopyState("idle"), 1500);
  };

  return (
    <tr className={styles.row}>
      <td className={styles.label}>{account.label}</td>
      <td className={account.handle === "미승인" ? styles.muted : styles.mono}>
        {account.handle}
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
            {copyState === "copied" ? "복사됨" : "링크 복사"}
          </Button>
          {copyState === "failed" && (
            <div className={styles.copyError}>
              복사 실패 — 아래 링크를 직접 선택해 복사하세요
              <div className={styles.linkText}>{account.connectUrl}</div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
