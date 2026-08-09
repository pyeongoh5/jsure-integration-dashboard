import { useMemo, useState } from "react";
import { JP_BANKS } from "@jsure/shared";
import { t } from "@i18n";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import styles from "./BankSelect.module.css";

/** 국가별 은행 목록의 공통 모양. JP_BANKS 는 nameJa 를 쓰므로 호출부가 맞춰 넘긴다. */
export type BankOption = { code: string; name: string };

interface Props {
  value: BankOption | null;
  onChange: (bank: BankOption) => void;
  /** 검색 대상 목록. 생략하면 일본 은행. */
  banks?: readonly BankOption[];
  /** 검색창 안내 문구. 코드 자릿수가 국가마다 달라 받는다. */
  searchPlaceholder?: string;
}

const SCROLL_BATCH = 50;

const JP_BANK_OPTIONS: readonly BankOption[] = JP_BANKS.map((bank) => ({
  code: bank.code,
  name: bank.nameJa,
}));

export function BankSelect({
  value,
  onChange,
  banks = JP_BANK_OPTIONS,
  searchPlaceholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(SCROLL_BATCH);

  const filtered = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return banks;
    return banks.filter(
      (bank) => bank.name.includes(keyword) || bank.code.startsWith(keyword),
    );
  }, [query, banks]);

  function updateQuery(next: string) {
    setQuery(next);
    setVisibleCount(SCROLL_BATCH);
  }

  // 바닥 근처까지 스크롤하면 다음 배치 렌더 (무한 스크롤)
  function handleListScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
      setVisibleCount((count) => Math.min(count + SCROLL_BATCH, filtered.length));
    }
  }

  function pick(bank: BankOption) {
    onChange(bank);
    setOpen(false);
    updateQuery("");
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={[styles.field, !value ? styles.fieldPlaceholder : ""].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
      >
        <i className={`fa-solid fa-magnifying-glass ${styles.icon}`} />
        {value ? `${value.name} (${value.code})` : t("me.bank.searchTrigger")}
      </button>

      {open && (
        <>
          <BodyScrollLock />
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalHead}>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t("me.bank.closeAriaLabel")}
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <input
              autoFocus
              className={styles.search}
              type="text"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder={searchPlaceholder ?? t("me.bank.searchPlaceholder")}
            />
          </div>
          <div className={styles.list} onScroll={handleListScroll}>
            {filtered.length === 0 && (
              <div className={styles.empty}>{t("me.bank.empty")}</div>
            )}
            {filtered.slice(0, visibleCount).map((bank) => (
              <button
                type="button"
                key={bank.code}
                className={styles.item}
                onClick={() => pick(bank)}
              >
                <span className={styles.code}>{bank.code}</span>
                <span className={styles.name}>{bank.name}</span>
              </button>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/** 모달이 열려 있는 동안에만 뒤 페이지 스크롤을 잠근다. */
function BodyScrollLock() {
  useBodyScrollLock();
  return null;
}
