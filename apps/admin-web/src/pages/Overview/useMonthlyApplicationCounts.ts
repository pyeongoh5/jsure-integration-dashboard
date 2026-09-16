import { useEffect, useState } from "react";
import { translate, type AdminLanguage } from "@i18n/admin";
import { getMonthlyApplicationCounts } from "@/domains/application";
import { useLanguage } from "@/lib/i18n";

export type MonthlyApplicationPoint = {
  label: string;
  count: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; points: MonthlyApplicationPoint[] }
  | { kind: "error"; message: string };

/** 서버 집계("YYYY-MM", UTC+9)를 화면 라벨("N월")로 바꾼다 */
function toPoints(
  months: { month: string; count: number }[],
  language: AdminLanguage,
): MonthlyApplicationPoint[] {
  return months.map(({ month, count }) => ({
    label: translate("pages.overview.chart.monthLabel", language, {
      month: Number(month.slice(5)),
    }),
    count,
  }));
}

export function useMonthlyApplicationCounts() {
  const { language } = useLanguage();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getMonthlyApplicationCounts()
      .then((months) => {
        if (cancelled) return;
        setState({ kind: "ready", points: toPoints(months, language) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : translate("pages.overview.chart.loadFailed", language),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return state;
}
