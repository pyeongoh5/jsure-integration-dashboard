import { SUB_TYPE_LABEL, type SnsAccountSubType } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import { SnsProfileLink } from "../SnsProfileLink";

export type SnsAccountRef = { snsType: SnsAccountSubType; handle: string };

type Props = {
  /**
   * 응모 채널과 일치하는 SNS 계정. 가구매·단순리뷰 응모는 일치하는 계정이 없다.
   * 채널을 알 수 없는 핸들(snsType null)은 프로필 링크 없이 텍스트로만 노출된다.
   */
  applied: { snsType: SnsAccountSubType | null; handle: string } | null;
  /** 응모 채널 계정이 없을 때 대신 표기할 대표 SNS. */
  representative: SnsAccountRef | null;
};

/**
 * 인플루언서의 SNS ID 표기. 응모 채널 핸들이 있으면 `@handle`,
 * 없으면 `대표 SNS: {채널} - @handle`. 둘 다 없으면 아무것도 그리지 않는다.
 */
export function SnsHandleCell({ applied, representative }: Props) {
  const t = useT();
  if (applied) {
    return (
      <SnsProfileLink subType={applied.snsType} handle={applied.handle}>
        @{applied.handle}
      </SnsProfileLink>
    );
  }
  if (!representative) return null;
  return (
    <SnsProfileLink subType={representative.snsType} handle={representative.handle}>
      {t("domains.application.applicants.table.representativeSns", {
        snsType: SUB_TYPE_LABEL[representative.snsType],
        handle: representative.handle,
      })}
    </SnsProfileLink>
  );
}
