import { useState } from "react";
import { Button, Input } from "@/components/ui";
import type { AdminCampaignDetail } from "@/domains/jwin";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminCampaignDetail;
};

export function ConnectTab({ detail }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(detail.connectUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.connect}>
      <div className={styles.statusRow}>
        <span className={styles.label}>연동 상태</span>
        {detail.needsReconnect ? (
          <span className={styles.reconnect}>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> 재연동 필요
          </span>
        ) : detail.xUsername ? (
          <span className={styles.connected}>@{detail.xUsername} 연동됨</span>
        ) : (
          <span>미연동</span>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>브랜드 연동 링크</span>
        <div className={styles.urlBox}>
          <Input className={styles.urlInput} value={detail.connectUrl} readOnly />
          <Button
            variant="secondary"
            size="md"
            onClick={copy}
            iconLeft={<i className="fa-solid fa-copy" aria-hidden="true" />}
          >
            {copied ? "복사됨" : "복사"}
          </Button>
        </div>
        <p className={styles.note}>
          이 링크를 브랜드 담당자에게 전달하면 브랜드가 직접 X 계정을 연동합니다. 연동이 완료되면 위
          연동 상태에 계정이 표시됩니다.
        </p>
      </div>
    </div>
  );
}
