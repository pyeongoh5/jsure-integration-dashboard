import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
import { CampaignCard, SnsTabBar, useCampaignList } from "@/domains/campaign";
import "./Browse.css";

export function Browse() {
  const nav = useNavigate();
  const [sns, setSns] = useState<SnsType>(SnsTypeSchema.options[0]);

  const { data, isLoading, isError } = useCampaignList(sns);

  return (
    <div className="browse">
      <div className="browse__brand">
        <div className="browse__brand-title">J-SURE</div>
        <div className="browse__brand-subtitle">influencer</div>
      </div>
      <SnsTabBar value={sns} onChange={setSns} />
      <div className="browse__grid">
        {isLoading && (
          <>
            <div className="browse__skel" />
            <div className="browse__skel" />
            <div className="browse__skel" />
            <div className="browse__skel" />
          </>
        )}
        {!isLoading && isError && <div className="browse__empty">読み込みに失敗しました</div>}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className="browse__empty">対象のキャンペーンはまだありません</div>
        )}
        {!isLoading &&
          !isError &&
          data?.map((card) => (
            <CampaignCard key={card.id} card={card} onSelect={() => nav(`/campaigns/${card.id}`)} />
          ))}
      </div>
    </div>
  );
}
