import { useEffect, useState } from "react";
import type { PublicAdminUser } from "@jsure/shared";
import { adminUserLabel, listAdminUsers } from "@/domains/team";

export type UseAdminUserOptionsResult = {
  managers: PublicAdminUser[];
  loading: boolean;
};

/** 활성 어드민 사용자 목록을 이름순으로 가져온다. 담당자 지정 UI 전용 데이터 fetch 훅. */
export function useAdminUserOptions(): UseAdminUserOptionsResult {
  const [managers, setManagers] = useState<PublicAdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminUsers()
      .then((adminUsers) => {
        if (cancelled) return;
        const activeAdminUsers = adminUsers
          .filter((adminUser) => adminUser.status === "ACTIVE")
          .sort((first, second) => adminUserLabel(first).localeCompare(adminUserLabel(second)));
        setManagers(activeAdminUsers);
      })
      .catch((cause: unknown) => {
        console.error("운영 담당자 후보를 불러오지 못했습니다", cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { managers, loading };
}
