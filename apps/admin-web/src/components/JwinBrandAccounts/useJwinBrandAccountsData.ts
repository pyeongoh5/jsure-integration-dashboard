import { useEffect, useMemo, useState } from "react";
import { fetchBrandAccounts, jwinErrorMessage, type AdminBrandAccount } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { toJwinBrandAccountRow, type JwinBrandAccountRow } from "./jwinBrandAccountTransform";

export type JwinBrandAccountsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; items: AdminBrandAccount[] }
  | { kind: "error"; message: string };

export type UseJwinBrandAccountsDataResult = {
  state: JwinBrandAccountsLoadState;
  accounts: JwinBrandAccountRow[];
  reload: () => void;
};

export function useJwinBrandAccountsData(): UseJwinBrandAccountsDataResult {
  const t = useT();
  const [state, setState] = useState<JwinBrandAccountsLoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchBrandAccounts()
      .then((result) => {
        if (!cancelled) setState({ kind: "ready", items: result.accounts });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: jwinErrorMessage(error, t("jwin.account.loadFailed")),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, t]);

  const accounts = useMemo<JwinBrandAccountRow[]>(() => {
    if (state.kind !== "ready") return [];
    return state.items.map(toJwinBrandAccountRow);
  }, [state]);

  return {
    state,
    accounts,
    reload: () => setReloadKey((current) => current + 1),
  };
}
