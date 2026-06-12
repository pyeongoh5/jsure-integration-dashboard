import { useEffect, useState } from "react";
import { listApplications } from "@/domains/application";

export type MonthlyApplicationPoint = {
  label: string;
  count: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; points: MonthlyApplicationPoint[] }
  | { kind: "error"; message: string };

const MONTH_WINDOW = 12;

function buildPoints(
  applications: { appliedAt: string }[],
  now: Date,
): MonthlyApplicationPoint[] {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const date = new Date(application.appliedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: MonthlyApplicationPoint[] = [];
  for (let offset = MONTH_WINDOW - 1; offset >= 0; offset -= 1) {
    const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${target.getFullYear()}-${target.getMonth()}`;
    points.push({
      label: `${target.getMonth() + 1}월`,
      count: counts.get(key) ?? 0,
    });
  }
  return points;
}

export function useMonthlyApplicationCounts() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listApplications()
      .then((applications) => {
        if (cancelled) return;
        const points = buildPoints(applications, new Date());
        setState({ kind: "ready", points });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "응모 추이를 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
