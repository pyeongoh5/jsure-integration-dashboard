import { Link, useLocation } from "react-router-dom";
import { PRODUCTS, findProductByPath } from "@/lib/navigation";
import styles from "./ProductSwitcher.module.css";

/**
 * 최상단 제품 스위처. 인플루언서 운영과 J-WIN 을 라우트 단위로 갈라준다.
 * 현재 제품은 URL 로만 판단하므로 별도 전역 상태가 없다.
 */
export const ProductSwitcher = () => {
  const { pathname } = useLocation();
  const activeProduct = findProductByPath(pathname);

  return (
    <div className={styles.root}>
      <Link to={activeProduct.homePath} className={styles.brand}>
        <span className={styles.mark}>J</span>
        <span className={styles.brandName}>J-SURE ADMIN</span>
      </Link>

      <nav className={styles.tabs} aria-label="제품 선택">
        {PRODUCTS.map((product) => {
          const isActive = product.key === activeProduct.key;
          return (
            <Link
              key={product.key}
              to={product.homePath}
              aria-current={isActive ? "page" : undefined}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <span className={styles.tabIcon}>
                <i className={product.icon} />
              </span>
              <span className={styles.tabText}>
                <span className={styles.tabLabel}>{product.label}</span>
                <span className={styles.tabDescription}>{product.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
