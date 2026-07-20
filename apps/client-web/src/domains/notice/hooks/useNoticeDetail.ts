import { useEffect, useState } from "react";
import type { InfluencerNoticeDetail } from "@jsure/shared";
import { t } from "@i18n";
import { getNotice } from "../api";

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
      setState({
        notice: null,
        loading: false,
        error: t("pages.notices.invalidAccess"),
      });
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
              : t("pages.notices.detailLoadError"),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
