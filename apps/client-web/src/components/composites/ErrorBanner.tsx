import styles from "./ErrorBanner.module.css";

export function ErrorBanner({ message }: { message: string }) {
  return <div className={styles.root}>{message}</div>;
}
