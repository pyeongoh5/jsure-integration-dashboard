import { Link } from "react-router-dom";
import type { Product } from "@/lib/navigation";
import { useT } from "@/lib/i18n";

/**
 * 사이드바 상단에서 "지금 어느 제품을 보고 있는지"를 알려준다.
 * 서비스 전체 브랜딩은 최상단 ProductSwitcher 가 담당하므로 여기서는 제품만 표시한다.
 */
export const ActiveProduct = ({ product }: { product: Product }) => {
  const t = useT();
  return (
    <Link to={product.homePath} className="admin__brand-link">
      <div className="admin__brand">
        <div className="admin__logo">
          <i className={product.icon} />
        </div>
        <div className="admin__brand-text">
          <div className="admin__brand-name">{t(product.label)}</div>
          <span className="admin__brand-role">
            {product.description ? t(product.description) : null}
          </span>
        </div>
      </div>
    </Link>
  );
};
