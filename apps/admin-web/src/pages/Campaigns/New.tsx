import { useNavigate } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import { CampaignForm, EMPTY_CAMPAIGN_FORM, createCampaign } from "@/domains/campaign";

export function CampaignNew() {
  const navigate = useNavigate();

  const handleSubmit = async (values: Values) => {
    await createCampaign(values);
    navigate("/campaigns");
  };

  return (
    <div className="cmp">
      <div className="cmp__header">
        <h1 className="cmp__title">캠페인 만들기</h1>
        <p className="cmp__subtitle">새 캠페인 정보를 입력하세요.</p>
      </div>
      <CampaignForm
        initialValue={EMPTY_CAMPAIGN_FORM}
        submitLabel="생성"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/campaigns")}
      />
    </div>
  );
}
