import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#111" }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>ページが見つかりません</h2>
      <Link to="/" style={{ color: "#1d6cf3" }}>ホームへ</Link>
    </div>
  );
}
