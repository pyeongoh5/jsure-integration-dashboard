import { useEffect, useState } from "react";
import type { InfluencerNoticeDetail } from "@jsure/shared";
import { getNotice } from "../../lib/api/notices";

type State = {
  notice: InfluencerNoticeDetail | null;
  loading: boolean;
  error: string | null;
};

export function useNoticeDetail(id: string | undefined) {
  const [state, setState] = useState<State>({
    notice: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ notice: null, loading: false, error: "잘못된 접근입니다" });
      return;
    }
    let cancelled = false;
    setState({ notice: null, loading: true, error: null });
    (async () => {
      try {
        const notice = await getNotice(id);
        if (cancelled) return;
        setState({ notice, loading: false, error: null });
      } catch (caught) {
        if (cancelled) return;
        setState({
          notice: null,
          loading: false,
          error:
            caught instanceof Error
              ? caught.message
              : "공지를 불러올 수 없습니다",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
