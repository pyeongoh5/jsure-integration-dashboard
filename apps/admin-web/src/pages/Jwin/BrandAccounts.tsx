import { useState } from "react";
import { Button } from "@/components/ui";
import {
  useJwinBrandAccountsData,
  useJwinBrandAccountMutations,
  JwinBrandAccountTable,
  AddBrandAccountDialog,
} from "@/components/JwinBrandAccounts";
import styles from "./Jwin.module.css";

/** 클립보드 복사. 비보안 컨텍스트/권한 거부로 실패할 수 있어 성공 여부를 반환한다. */
async function copyToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function JwinBrandAccounts() {
  const { state, accounts, reload } = useJwinBrandAccountsData();
  const { create } = useJwinBrandAccountMutations(reload);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>브랜드 계정</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready" ? `${accounts.length}건` : "불러오는 중…"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setDialogOpen(true)}
          iconLeft={<i className="fa-solid fa-plus" aria-hidden="true" />}
        >
          계정 추가
        </Button>
      </div>

      <div className={styles.card}>
        {state.kind === "loading" ? (
          <div className={styles.empty}>불러오는 중…</div>
        ) : state.kind === "error" ? (
          <div className={styles.empty}>{state.message}</div>
        ) : (
          <JwinBrandAccountTable accounts={accounts} onCopyLink={copyToClipboard} />
        )}
      </div>

      <AddBrandAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={create}
      />
    </div>
  );
}
