import { useNavigate } from "react-router-dom";
import "./PageHeader.css";

interface Props {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function PageHeader({ title, showBack, right }: Props) {
  const nav = useNavigate();
  return (
    <header className="page-header">
      <div className="page-header__left">
        {showBack && (
          <button
            type="button"
            className="page-header__back"
            onClick={() => nav(-1)}
            aria-label="戻る"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
        )}
      </div>
      <div className="page-header__title">{title}</div>
      <div className="page-header__right">{right}</div>
    </header>
  );
}
