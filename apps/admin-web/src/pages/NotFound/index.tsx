import { Link } from "react-router-dom";
import { buttonClassNames } from "@/components/ui";
import styles from "./NotFound.module.css";

export function NotFound() {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>페이지를 찾을 수 없어요</h1>
        <p className={styles.subtitle}>요청하신 주소가 변경되었거나 더 이상 존재하지 않습니다.</p>
        <div className={styles.actions}>
          <Link to="/" className={buttonClassNames({ variant: "primary", size: "md" })}>
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
