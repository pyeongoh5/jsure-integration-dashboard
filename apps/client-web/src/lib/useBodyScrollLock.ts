import { useEffect } from "react";

/**
 * 모달이 열려 있는 동안 뒤 페이지가 스크롤되지 않게 한다.
 * 모바일에서 오버레이 위를 드래그하면 뒤 페이지가 따라 움직이는 문제를 막는다.
 *
 * 여러 모달이 겹쳐도 안전하도록 이전 값을 복원한다.
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);
}
