import { useParams } from "react-router-dom";

/**
 * S2 캠페인 생성·편집 (생성/편집 겸용). Phase 3~4에서 탭 UI로 채운다.
 * id가 없으면 생성, 있으면 편집 모드.
 */
export function JwinCampaignEdit() {
  const { id } = useParams();
  return (
    <section>
      <h1>{id ? "캠페인 편집" : "캠페인 생성"}</h1>
      <p>준비 중입니다.</p>
    </section>
  );
}
