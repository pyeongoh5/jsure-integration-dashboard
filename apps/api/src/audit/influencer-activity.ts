import type { AdminActivityAction, AdminActivityLog } from "@jsure/shared";

/**
 * 합성에 필요한 응모 필드. 전부 인플루언서 행동으로 채워지는 컬럼이다.
 *
 * reviewSubmittedAt 은 쓰지 않는다 — 카테고리 무관하게 모든 제출 경로가 찍는
 * "제출 완료" 마커라서 posts.submittedAt 과 같은 사건이고, posts 쪽이 서브타입까지
 * 담아 더 정확하다.
 */
export type InfluencerActivitySource = {
  appliedAt: Date;
  orderSubmittedAt: Date | null;
  receivedAt: Date | null;
  posts: {
    subType: string;
    submittedAt: Date;
    insightSubmittedAt: Date | null;
  }[];
};

function entry(
  id: string,
  action: AdminActivityAction,
  at: Date,
  metadata: Record<string, unknown> | null = null,
): AdminActivityLog {
  return {
    id,
    action,
    origin: "INFLUENCER",
    // 응모의 인플루언서는 1명으로 고정이라 행위자가 자명하다. actorId 에
    // 어드민/인플루언서 id 를 섞지 않기 위해 null 로 둔다.
    actor: null,
    metadata,
    createdAt: at.toISOString(),
  };
}

/**
 * 같은 시각에 일어난 제출을 1건으로 묶는다. 일괄 제출 폼에서 서브타입 3개를
 * 한 번에 올리면 타임스탬프가 동일한데, 이를 3행으로 늘어놓으면 타임라인이
 * 중복으로 보인다.
 */
function groupBySameInstant(
  posts: { subType: string; at: Date }[],
): { at: Date; subTypes: string[] }[] {
  const groups = new Map<string, { at: Date; subTypes: string[] }>();
  for (const post of posts) {
    const key = post.at.toISOString();
    const existing = groups.get(key);
    if (existing) {
      existing.subTypes.push(post.subType);
      continue;
    }
    groups.set(key, { at: post.at, subTypes: [post.subType] });
  }
  return Array.from(groups.values());
}

/**
 * 인플루언서 액션을 응모의 타임스탬프 컬럼에서 합성한다. DB 에 기록된 로그가
 * 아니라 조회 시점의 파생값이다 — 감사 로그 계측 이전 응모도 흐름이 보이는
 * 대가로, 컬럼이 덮어써지는 재제출은 마지막 1회만 남는다.
 *
 * 응모 취소는 전용 타임스탬프가 없어(status 만 바뀐다) 합성할 수 없다.
 */
export function influencerActivityEntries(
  source: InfluencerActivitySource,
): AdminActivityLog[] {
  const entries: AdminActivityLog[] = [
    entry("synthetic-apply", "APPLICATION_APPLY", source.appliedAt),
  ];
  if (source.orderSubmittedAt) {
    entries.push(
      entry(
        "synthetic-order-submit",
        "APPLICATION_ORDER_SUBMIT",
        source.orderSubmittedAt,
      ),
    );
  }
  if (source.receivedAt) {
    entries.push(
      entry(
        "synthetic-receive-confirm",
        "APPLICATION_RECEIVE_CONFIRM",
        source.receivedAt,
      ),
    );
  }

  const submits = groupBySameInstant(
    source.posts.map((post) => ({
      subType: post.subType,
      at: post.submittedAt,
    })),
  );
  for (const group of submits) {
    entries.push(
      entry(
        `synthetic-post-submit-${group.at.toISOString()}`,
        "POST_SUBMIT",
        group.at,
        { subTypes: group.subTypes },
      ),
    );
  }

  const insights = groupBySameInstant(
    source.posts
      .filter((post) => post.insightSubmittedAt !== null)
      .map((post) => ({
        subType: post.subType,
        at: post.insightSubmittedAt!,
      })),
  );
  for (const group of insights) {
    entries.push(
      entry(
        `synthetic-insight-submit-${group.at.toISOString()}`,
        "INSIGHT_SUBMIT",
        group.at,
        { subTypes: group.subTypes },
      ),
    );
  }

  return entries;
}
