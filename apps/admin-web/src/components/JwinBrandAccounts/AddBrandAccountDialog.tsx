import { useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import type { AdminBrandAccount } from "@/domains/jwin";
import styles from "./AddBrandAccountDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (label: string) => Promise<AdminBrandAccount | null>;
};

/** 계정 추가 다이얼로그. 입력 상태는 여기서만 보관한다(§7 — 부모로 끌어올리지 않음). */
export function AddBrandAccountDialog({ open, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminBrandAccount | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleClose = () => {
    setLabel("");
    setCreating(false);
    setError(null);
    setCreated(null);
    setCopyState("idle");
    onClose();
  };

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    setError(null);
    const account = await onCreate(label.trim());
    setCreating(false);
    if (account) {
      setCreated(account);
    } else {
      setError("계정 생성에 실패했습니다.");
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.connectUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={created ? "연동 링크" : "계정 추가"}
      footer={
        created ? (
          <Button variant="primary" size="md" onClick={handleClose}>
            닫기
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="md" onClick={handleClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              disabled={!label.trim() || creating}
            >
              {creating ? "생성 중…" : "생성"}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className={styles.body}>
          <p className={styles.description}>
            아래 링크를 브랜드 담당자에게 전달하세요. 브랜드가 자기 X 계정으로 승인하면 연동이
            완료됩니다.
          </p>
          <div className={styles.linkRow}>
            <Input value={created.connectUrl} readOnly />
            <Button variant="secondary" size="md" onClick={handleCopy}>
              {copyState === "copied" ? "복사됨" : "복사"}
            </Button>
          </div>
          {copyState === "failed" && (
            <div className={styles.error}>
              복사 실패 — 위 입력창의 링크를 직접 선택해 복사하세요
            </div>
          )}
        </div>
      ) : (
        <div className={styles.body}>
          <label className={styles.label} htmlFor="brand-account-label">
            라벨
          </label>
          <Input
            id="brand-account-label"
            value={label}
            onChange={setLabel}
            placeholder="예: 코카콜라 재팬 공식"
            disabled={creating}
            autoFocus
          />
          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </Dialog>
  );
}
