import { useEffect, useMemo, useState } from "react";
import { fetchBrandAccounts, type AdminBrandAccount } from "@/domains/jwin";
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
          message: error instanceof Error ? error.message : "계정 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
