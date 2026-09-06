import { useState } from "react";
import { Button } from "@/components/ui";
import {
  useJwinBrandAccountsData,
  useJwinBrandAccountMutations,
  JwinBrandAccountTable,
  AddBrandAccountDialog,
  EditBrandAccountDialog,
  type JwinBrandAccountRow,
} from "@/components/JwinBrandAccounts";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const { state, accounts, reload } = useJwinBrandAccountsData();
  const { create, edit } = useJwinBrandAccountMutations(reload);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JwinBrandAccountRow | null>(null);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t("jwin.account.listTitle")}</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready"
              ? t("jwin.common.countItems", { count: accounts.length })
              : t("jwin.common.loading")}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setDialogOpen(true)}
          iconLeft={<i className="fa-solid fa-plus" aria-hidden="true" />}
        >
          {t("jwin.account.add")}
        </Button>
      </div>

      <div className={styles.card}>
        {state.kind === "loading" ? (
          <div className={styles.empty}>{t("jwin.common.loading")}</div>
        ) : state.kind === "error" ? (
          <div className={styles.empty}>{state.message}</div>
        ) : (
          <JwinBrandAccountTable
            accounts={accounts}
            onCopyLink={copyToClipboard}
            onEdit={setEditTarget}
          />
        )}
      </div>

      <AddBrandAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={create}
      />

      <EditBrandAccountDialog
        account={editTarget}
        onClose={() => setEditTarget(null)}
        onEdit={edit}
      />
    </div>
  );
}
