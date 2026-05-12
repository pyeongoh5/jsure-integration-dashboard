import { Link } from "react-router-dom";
import "./NotFound.css";

export function NotFound() {
  return (
    <div className="nf">
      <div className="nf-card">
        <div className="nf__code">404</div>
        <h1 className="nf__title">페이지를 찾을 수 없어요</h1>
        <p className="nf__subtitle">요청하신 주소가 변경되었거나 더 이상 존재하지 않습니다.</p>
        <div className="nf__actions">
          <Link to="/" className="nf__btn">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
