import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listApplications } from "../../lib/api/applications";
import { ApplicationCard } from "../../components/Application/ApplicationCard";
import "./Applications.css";

export function Applications() {
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications"],
    queryFn: listApplications,
  });

  return (
    <div className="apps">
      <header className="apps__header">
        <h1>応募内訳</h1>
      </header>
      <div className="apps__list">
        {isLoading && <div className="apps__empty">読み込み中…</div>}
        {isError && (
          <div className="apps__empty">読み込みに失敗しました</div>
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className="apps__empty">
            まだ応募していません
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="apps__cta"
                onClick={() => nav("/")}
              >
                キャンペーンを探す
              </button>
            </div>
          </div>
        )}
        {data?.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            onSelect={() => nav(`/applications/${app.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
