import { useLocation } from "react-router-dom";
import { findNavMatch } from "@/lib/navigation";
import "./Breadcrumb.css";

export function Breadcrumb() {
  const { pathname } = useLocation();
  const match = findNavMatch(pathname);

  if (!match) return <div className="bc" />;

  return (
    <div className="bc">
      <span>{match.group.title}</span>
      <span className="bc__sep">›</span>
      <span>{match.item.label}</span>
    </div>
  );
}
