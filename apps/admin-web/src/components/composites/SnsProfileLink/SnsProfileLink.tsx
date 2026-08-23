import type { ReactNode } from "react";
import { snsProfileUrlOrNull, type CampaignSubType } from "@jsure/shared";
import styles from "./SnsProfileLink.module.css";

type Props = {
  /** SNS 채널. QOO10/LIPS/ATCOSME 처럼 프로필 URL 규칙이 없는 채널이면 링크를 걸지 않는다. */
  subType: CampaignSubType | null | undefined;
  handle: string | null | undefined;
  /** SNS ID 텍스트 또는 SNS 아이콘. 링크를 걸 수 없으면 그대로 렌더링된다. */
  children: ReactNode;
  className?: string;
};

/**
 * SNS ID/아이콘을 해당 채널 프로필로 나가는 아웃링크로 감싼다.
 * 링크 불가(핸들 없음·프로필 URL 규칙 없는 채널)일 때는 children 만 그대로 노출한다.
 */
export function SnsProfileLink({ subType, handle, children, className }: Props) {
  const profileUrl = subType ? snsProfileUrlOrNull(subType, handle) : null;
  if (!profileUrl) return <>{children}</>;
  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noreferrer"
      title={profileUrl}
      className={className ? `${styles.link} ${className}` : styles.link}
      // 행 클릭(상세 모달 등)과 링크 이동이 함께 터지지 않게 막는다.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}
