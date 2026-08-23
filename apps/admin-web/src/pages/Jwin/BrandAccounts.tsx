import { useState } from "react";
import { Button } from "@/components/ui";
import {
  useJwinBrandAccountsData,
  useJwinBrandAccountMutations,
  JwinBrandAccountTable,
  AddBrandAccountDialog,
} from "@/components/JwinBrandAccounts";
import styles from "./Jwin.module.css";

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
          <JwinBrandAccountTable
            accounts={accounts}
            onCopyLink={(url) => void navigator.clipboard.writeText(url)}
          />
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
