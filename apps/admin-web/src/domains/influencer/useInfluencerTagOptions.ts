import { useEffect, useState } from "react";
import { listInfluencerTags } from "./api";

/**
 * 태그 입력의 자동완성 후보(마스터 전체 라벨).
 * 실패해도 화면을 막지 않는다 — 추천만 사라지고 자유 입력은 그대로 된다.
 */
export function useInfluencerTagOptions(): string[] {
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    listInfluencerTags()
      .then((tags) => {
        if (!cancelled) setLabels(tags.map((tag) => tag.label));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return labels;
}
