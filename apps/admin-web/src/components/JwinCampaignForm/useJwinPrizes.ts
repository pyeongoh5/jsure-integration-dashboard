import { useCallback, useEffect, useState } from "react";
import {
  appendPrizeCodes,
  createPrize,
  fetchPrizes,
  jwinErrorMessage,
  updatePrize,
  type AdminPrize,
  type AdminPrizeCreate,
  type AdminPrizePatch,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinPrizesResult = {
  loading: boolean;
  loadError: string | null;
  prizes: AdminPrize[];
  reload: () => void;
  /** 성공하면 null, 실패하면 사용자에게 보여줄 메시지 */
  add: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
  edit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
  appendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

/**
 * 경품 목록 + 등록/정정/코드보충.
 * 등록·보충 API 는 Prisma 모델을 그대로 돌려주므로 응답을 쓰지 않고 목록을 다시 불러온다.
 * 실패 시에는 서버가 준 한국어 메시지를 그대로 올려보낸다(없으면 번역된 fallback).
 */
export function useJwinPrizes(campaignId: string): UseJwinPrizesResult {
  const t = useT();
  const [prizes, setPrizes] = useState<AdminPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchPrizes(campaignId)
      .then((result) => {
        if (!cancelled) setPrizes(result.prizes);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(jwinErrorMessage(error, t("jwin.prize.loadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey, t]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const add = useCallback(
    async (body: Omit<AdminPrizeCreate, "campaignId">): Promise<string | null> => {
      try {
        await createPrize({ ...body, campaignId });
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.prize.error.addFailed"));
      }
    },
    [campaignId, reload, t],
  );

  const edit = useCallback(
    async (prizeId: string, body: AdminPrizePatch): Promise<string | null> => {
      try {
        await updatePrize(prizeId, body);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.prize.error.editFailed"));
      }
    },
    [reload, t],
  );

  const appendCodes = useCallback(
    async (prizeId: string, codesText: string): Promise<string | null> => {
      try {
        await appendPrizeCodes(prizeId, codesText);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.prize.error.appendFailed"));
      }
    },
    [reload, t],
  );

  return { loading, loadError, prizes, reload, add, edit, appendCodes };
}
