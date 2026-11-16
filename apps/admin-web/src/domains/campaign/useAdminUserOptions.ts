import { useEffect, useState } from "react";
import type { PublicAdminUser } from "@jsure/shared";
import { adminUserLabel, listAdminUsers } from "@/domains/team";
import { useT } from "@/lib/i18n";

export type UseAdminUserOptionsResult = {
  managers: PublicAdminUser[];
  loading: boolean;
  /** fetch 실패 메시지. 성공했거나 아직 로딩 중이면 null — "후보 없음" 과 구분해야
   *  호출부(일괄 지정 다이얼로그 등)가 실패를 빈 목록으로 착각해 담당자를 날리지 않는다. */
  error: string | null;
};

/** 활성 어드민 사용자 목록을 이름순으로 가져온다. 담당자 지정 UI 전용 데이터 fetch 훅. */
export function useAdminUserOptions(): UseAdminUserOptionsResult {
  const t = useT();
  const [managers, setManagers] = useState<PublicAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminUsers()
      .then((adminUsers) => {
        if (cancelled) return;
        const activeAdminUsers = adminUsers
          .filter((adminUser) => adminUser.status === "ACTIVE")
          .sort((first, second) => adminUserLabel(first).localeCompare(adminUserLabel(second)));
        setManagers(activeAdminUsers);
        setError(null);
      })
      .catch((cause: unknown) => {
        console.error("운영 담당자 후보를 불러오지 못했습니다", cause);
        if (cancelled) return;
        setError(t("domains.campaign.managers.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return { managers, loading, error };
}
