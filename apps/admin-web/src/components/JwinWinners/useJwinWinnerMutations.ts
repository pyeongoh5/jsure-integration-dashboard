import { useCallback, useState } from "react";
import {
  fetchShipping,
  jwinErrorMessage,
  updateFulfillment,
  type AdminShipping,
  type AdminWinner,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinWinnerMutationsResult = {
  /** 성공하면 배송지, 실패하면 null (에러는 shippingError 로) */
  viewShipping: (winnerId: string) => Promise<AdminShipping | null>;
  shippingLoading: boolean;
  shippingError: string | null;
  /** 성공하면 갱신된 당첨자, 실패하면 사용자에게 보여줄 메시지 */
  markShipped: (winnerId: string) => Promise<AdminWinner | string>;
};

/**
 * 배송지 열람 · 발송 완료 처리.
 * 열람은 서버가 감사 로그에 남기므로 화면에서 미리 받아두거나 캐시하지 않는다 —
 * 실제로 연 횟수와 로그가 어긋나면 감사 기록의 의미가 없어진다.
 */
export function useJwinWinnerMutations(): UseJwinWinnerMutationsResult {
  const t = useT();
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const viewShipping = useCallback(
    async (winnerId: string): Promise<AdminShipping | null> => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        return await fetchShipping(winnerId);
      } catch (error: unknown) {
        setShippingError(jwinErrorMessage(error, t("jwin.winner.shipping.loadFailed")));
        return null;
      } finally {
        setShippingLoading(false);
      }
    },
    [t],
  );

  const markShipped = useCallback(
    async (winnerId: string): Promise<AdminWinner | string> => {
      try {
        return await updateFulfillment(winnerId, { fulfillment: "SHIPPED" });
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.winner.shipDialog.failed"));
      }
    },
    [t],
  );

  return { viewShipping, shippingLoading, shippingError, markShipped };
}
