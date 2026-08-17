import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { useJwinCampaignsData, JwinCampaignTable } from "@/components/JwinCampaigns";
import styles from "./Jwin.module.css";

export function JwinCampaigns() {
  const navigate = useNavigate();
  const { state, rows } = useJwinCampaignsData();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>캠페인 관리</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready" ? `${rows.length}건` : "불러오는 중…"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate("/jwin/campaigns/new")}
          iconLeft={<i className="fa-solid fa-plus" aria-hidden="true" />}
        >
          캠페인 생성
        </Button>
      </div>

      <div className={styles.card}>
        {state.kind === "loading" ? (
          <div className={styles.empty}>불러오는 중…</div>
        ) : state.kind === "error" ? (
          <div className={styles.empty}>{state.message}</div>
        ) : (
          <JwinCampaignTable rows={rows} onRowClick={(id) => navigate(`/jwin/campaigns/${id}`)} />
        )}
      </div>
    </div>
  );
}
