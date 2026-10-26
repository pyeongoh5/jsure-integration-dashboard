import { useEffect, useState } from "react";
import type { InfluencerTag } from "@jsure/shared";
import { listInfluencerTags } from "./api";

/**
 * 태그 마스터 전체. 태그 입력의 자동완성 후보이자 목록 태그 필터의 선택지다.
 * 실패해도 화면을 막지 않는다 — 추천·필터만 비고 나머지는 그대로 쓴다.
 */
export function useInfluencerTags(): InfluencerTag[] {
  const [tags, setTags] = useState<InfluencerTag[]>([]);

  useEffect(() => {
    let cancelled = false;
    listInfluencerTags()
      .then((loaded) => {
        if (!cancelled) setTags(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return tags;
}
