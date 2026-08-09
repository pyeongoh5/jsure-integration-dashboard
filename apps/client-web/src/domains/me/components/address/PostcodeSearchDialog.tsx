import { useEffect, useRef } from "react";
import {
  embedPostcodeSearch,
  resizePostcodeSearch,
  type KrAddressResult,
} from "@/lib/daumPostcode";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { t } from "@i18n";
import styles from "./Address.module.css";

/**
 * 다음 우편번호 검색 레이어.
 *
 * 팝업(window.open)은 LINE 인앱 브라우저에서 막힐 수 있어 embed 로만 띄운다.
 */
export function PostcodeSearchDialog({
  onSelect,
  onClose,
}: {
  onSelect: (result: KrAddressResult) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock();

  // 핸들러는 부모가 그릴 때마다 새 함수라, 의존성에 넣으면 리렌더마다 iframe 이
  // 다시 붙어 방금 누른 입력이 사라진다. ref 로 최신 값만 참조하고 embed 는 1회만.
  const handlersRef = useRef({ onSelect, onClose });
  handlersRef.current = { onSelect, onClose };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const embedded = embedPostcodeSearch(container, {
      onSelect: (result) => handlersRef.current.onSelect(result),
      onClose: () => handlersRef.current.onClose(),
    });
    if (!embedded) {
      handlersRef.current.onClose();
      return;
    }
    // 컨테이너 크기가 바뀌면(회전·키보드) iframe 도 맞춰 준다.
    const observer = new ResizeObserver(() => resizePostcodeSearch(container));
    observer.observe(container);

    return () => {
      observer.disconnect();
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className={styles.searchDim} role="dialog" aria-modal="true">
      <div className={styles.searchPanel}>
        <div className={styles.searchHead}>
          <span className={styles.searchTitle}>
            {t("me.addressKr.searchTitle")}
          </span>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
            aria-label={t("me.addressKr.searchClose")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div ref={containerRef} className={styles.searchBody} />
      </div>
    </div>
  );
}
