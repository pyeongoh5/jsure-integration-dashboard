import type { ReactNode } from "react";
import "./Card.css";

type CardProps = {
  title?: ReactNode;
  content?: ReactNode;
  bottomAffix?: ReactNode;
};

export function Card({ title, content, bottomAffix }: CardProps) {
  return (
    <div className="ui-card">
      {title !== undefined && <div className="ui-card__title">{title}</div>}
      {content !== undefined && <div className="ui-card__content">{content}</div>}
      {bottomAffix !== undefined && <div className="ui-card__bottom-affix">{bottomAffix}</div>}
    </div>
  );
}
