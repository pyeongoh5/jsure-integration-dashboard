import styles from "./TagChip.module.css";

type Props = {
  tag: string;
};

/** 어드민 전용 캠페인 관리 태그. 캠페인 카드와 캠페인 필터가 같은 배지를 쓴다. */
export function TagChip({ tag }: Props) {
  return <span className={styles.chip}>{tag}</span>;
}
