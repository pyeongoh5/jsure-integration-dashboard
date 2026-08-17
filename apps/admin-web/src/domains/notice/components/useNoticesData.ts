import { useCallback, useEffect, useState } from "react";
import type { NoticeResponse } from "@jsure/shared";
import { listNotices } from "../api";
import { useT } from "@/lib/i18n";

type State = {
  notices: NoticeResponse[];
  loading: boolean;
  error: string | null;
};

export function useNoticesData() {
  const t = useT();
  const [state, setState] = useState<State>({
    notices: [],
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await listNotices();
      setState({ notices: response.items, loading: false, error: null });
    } catch (error) {
      setState({
        notices: [],
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : t("domains.notice.errors.listLoadFailed"),
      });
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
