import { TagChip } from "../TagChip";
import styles from "./TagChipList.module.css";

type Props = {
  tags: string[];
};

/**
 * 태그 뱃지 나열 — 인플루언서 관리 태그를 이름·SNS 아이디 옆에 붙일 때 쓴다.
 * 응모자·원고·인플루언서 목록이 같은 간격과 줄바꿈을 공유한다.
 */
export function TagChipList({ tags }: Props) {
  if (tags.length === 0) return null;
  return (
    <span className={styles.list}>
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} />
      ))}
    </span>
  );
}
