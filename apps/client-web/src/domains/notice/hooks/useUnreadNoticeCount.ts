import { useMemo } from "react";
import { useNoticesData } from "./useNoticesData";
import { useReadNoticeIds } from "./useReadNotices";

export function useUnreadNoticeCount(): number {
  const { notices } = useNoticesData();
  const readIds = useReadNoticeIds();
  return useMemo(() => {
    const readSet = new Set(readIds);
    return notices.filter((notice) => !readSet.has(notice.id)).length;
  }, [notices, readIds]);
}
