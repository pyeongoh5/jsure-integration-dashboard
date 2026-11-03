import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  type CampaignAudienceEntry,
  type CampaignAudienceInput,
  type CampaignAudienceSource,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

type AudienceRow = {
  campaignId: string;
  influencerId: string;
  source: CampaignAudienceSource;
  sourceRefId: string | null;
};

/**
 * 해석 결과. unknownTagLabels 를 예외로 던지지 않고 돌려주는 이유는 프리뷰와 저장이
 * **같은 해석 경로**를 쓰기 위해서다 — 프리뷰는 알려주기만 하고, 저장만 거절한다.
 * 경로를 둘로 나누면 한쪽만 고쳐 놓고 다른 쪽이 달라지는 드리프트가 생긴다.
 */
type ResolvedAudience = {
  rows: AudienceRow[];
  unknownTagLabels: string[];
};

/** 대상자 해석에 쓰는 트랜잭션 클라이언트 — 캠페인 생성/수정 트랜잭션 안에서도 호출된다. */
type AudienceTx = Pick<
  PrismaService,
  | "campaignApplication"
  | "influencerTag"
  | "influencerTagAssignment"
  | "influencer"
  | "campaignAudience"
>;

/** 저장돼 있는 대상자 행 — 여기서 규칙(피커 선택)을 거꾸로 복원한다. */
type ExistingRow = {
  influencerId: string;
  source: CampaignAudienceSource;
  sourceRefId: string | null;
};

/** 해당 출처로 들어온 행들의 sourceRefId 집합. */
function refSet(
  rows: ExistingRow[],
  source: CampaignAudienceSource,
): Set<string> {
  const refs = new Set<string>();
  for (const row of rows) {
    if (row.source === source && row.sourceRefId !== null) {
      refs.add(row.sourceRefId);
    }
  }
  return refs;
}

export function hasAudienceInput(input: CampaignAudienceInput): boolean {
  return (
    input.audienceCampaignIds.length > 0 ||
    input.audienceTagLabels.length > 0 ||
    input.audienceInfluencerIds.length > 0
  );
}

@Injectable()
export class CampaignAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 규칙(피커 선택)을 대상자 행에 반영한다. input 이 null 이면 아무것도 건드리지 않는다.
   *
   * 대상자 명단은 **규칙의 함수**다 — 규칙을 풀어 나온 명단으로 통째로 교체한다.
   * 개별 제외 같은 두 번째 수단을 두면 "대상자는 무엇으로 정해지는가"의 답이 둘이
   * 되고, 그때부터 변경분 추적이 필요해진다. 수단이 하나뿐이면 이 함수로 끝난다.
   */
  async applyInput(
    tx: AudienceTx,
    campaignId: string,
    input: CampaignAudienceInput | null,
  ): Promise<void> {
    if (input === null) return;

    const { rows, unknownTagLabels } = await this.resolve(tx, campaignId, input);
    if (unknownTagLabels.length > 0) {
      throw new NotFoundException(
        `등록되지 않은 인플루언서 태그입니다: ${unknownTagLabels.join(", ")}`,
      );
    }

    // 규칙에서 빠진 사람은 지운다. 빈 명단에 notIn: [] 를 넘기면 조건이 모호해지므로
    // 전체 삭제로 갈라 쓴다.
    const keep = rows.map((row) => row.influencerId);
    await tx.campaignAudience.deleteMany({
      where:
        keep.length > 0
          ? { campaignId, influencerId: { notIn: keep } }
          : { campaignId },
    });
    if (rows.length === 0) return;
    await tx.campaignAudience.createMany({ data: rows, skipDuplicates: true });
  }

  /**
   * 저장된 대상자에서 규칙을 거꾸로 복원한다 — 수정 화면의 피커 기선택용.
   * 결과가 0명이었던 규칙은 남는 행이 없어 복원되지 않는다(프리뷰 인원수로 드러난다).
   */
  async selection(campaignId: string): Promise<CampaignAudienceInput> {
    const rows = await this.prisma.campaignAudience.findMany({
      where: { campaignId },
      select: { influencerId: true, source: true, sourceRefId: true },
    });
    const tagIds = Array.from(refSet(rows, "TAG"));
    const tags =
      tagIds.length > 0
        ? await this.prisma.influencerTag.findMany({
            where: { id: { in: tagIds } },
            select: { label: true },
          })
        : [];
    return {
      audienceCampaignIds: Array.from(refSet(rows, "CAMPAIGN")),
      audienceTagLabels: tags.map((tag) => tag.label),
      audienceInfluencerIds: rows
        .filter((row) => row.source === "MANUAL")
        .map((row) => row.influencerId),
    };
  }

  /**
   * 저장 전 프리뷰 — 이미 등록된 대상자와 이번에 추가될 인원을 합쳐 보여준다.
   * 저장과 같은 resolve() 를 쓰므로 "프리뷰에는 있는데 저장하면 없다"가 생기지 않는다.
   */
  /**
   * 저장 전 프리뷰 — **저장하면 대상자 명단이 이렇게 된다**를 그대로 보여준다.
   * 저장과 같은 resolve() 를 쓰므로 "프리뷰에는 있는데 저장하면 없다"가 생기지 않는다.
   * 선택에서 빠진 사람은 저장 시 빠지므로 여기서도 보이지 않는다.
   */
  async preview(
    campaignId: string | null,
    input: CampaignAudienceInput,
  ): Promise<{
    audience: CampaignAudienceEntry[];
    unknownTagLabels: string[];
  }> {
    const [savedIds, resolved] = await Promise.all([
      campaignId
        ? this.savedInfluencerIds(campaignId)
        : Promise.resolve(new Set<string>()),
      this.resolve(this.prisma, campaignId ?? "", input),
    ]);

    const audience = await this.hydrate(resolved.rows, savedIds);
    return { audience, unknownTagLabels: resolved.unknownTagLabels };
  }

  /** 이미 저장된 대상자 id — 프리뷰에서 "추가 예정" 여부를 가르는 데만 쓴다. */
  private async savedInfluencerIds(campaignId: string): Promise<Set<string>> {
    const rows = await this.prisma.campaignAudience.findMany({
      where: { campaignId },
      select: { influencerId: true },
    });
    return new Set(rows.map((row) => row.influencerId));
  }

  /**
   * 세 경로 해석 + 중복 제거. 같은 사람이 여러 경로로 걸리면 먼저 잡힌 출처가 남는다
   * (복합 PK 가 DB 에서도 막아주지만, 출처를 결정하려면 여기서 걸러야 한다).
   */
  private async resolve(
    tx: AudienceTx,
    campaignId: string,
    input: CampaignAudienceInput,
  ): Promise<ResolvedAudience> {
    const [fromCampaigns, fromTags, fromInfluencers] = await Promise.all([
      this.rowsFromCampaigns(tx, campaignId, input.audienceCampaignIds),
      this.rowsFromTags(tx, campaignId, input.audienceTagLabels),
      this.rowsFromInfluencers(tx, campaignId, input.audienceInfluencerIds),
    ]);

    const deduped = new Map<string, AudienceRow>();
    for (const row of [
      ...fromCampaigns,
      ...fromTags.rows,
      ...fromInfluencers,
    ]) {
      if (!deduped.has(row.influencerId)) deduped.set(row.influencerId, row);
    }
    return {
      rows: Array.from(deduped.values()),
      unknownTagLabels: fromTags.unknownLabels,
    };
  }

  /** 기존 캠페인에서 승인(선정)된 적 있는 인플루언서. 승인 후 취소된 인원은 제외된다. */
  private async rowsFromCampaigns(
    tx: AudienceTx,
    campaignId: string,
    sourceCampaignIds: string[],
  ): Promise<AudienceRow[]> {
    const unique = Array.from(new Set(sourceCampaignIds)).filter(
      (id) => id !== campaignId,
    );
    if (unique.length === 0) return [];
    const applications = await tx.campaignApplication.findMany({
      where: {
        campaignId: { in: unique },
        status: { in: SLOT_CONSUMING_STATUSES },
      },
      select: { campaignId: true, influencerId: true },
    });
    return applications.map((application) => ({
      campaignId,
      influencerId: application.influencerId,
      source: "CAMPAIGN" as const,
      sourceRefId: application.campaignId,
    }));
  }

  /** 관리 태그가 달린 인플루언서. 마스터에 없는 라벨은 건너뛰고 호출부에 알린다. */
  private async rowsFromTags(
    tx: AudienceTx,
    campaignId: string,
    tagLabels: string[],
  ): Promise<{ rows: AudienceRow[]; unknownLabels: string[] }> {
    const unique = Array.from(new Set(tagLabels));
    if (unique.length === 0) return { rows: [], unknownLabels: [] };
    const tags = await tx.influencerTag.findMany({
      where: { label: { in: unique } },
      select: { id: true, label: true },
    });
    const foundLabels = new Set(tags.map((tag) => tag.label));
    const unknownLabels = unique.filter((label) => !foundLabels.has(label));
    if (tags.length === 0) return { rows: [], unknownLabels };

    const assignments = await tx.influencerTagAssignment.findMany({
      where: { tagId: { in: tags.map((tag) => tag.id) } },
      select: { influencerId: true, tagId: true },
    });
    return {
      rows: assignments.map((assignment) => ({
        campaignId,
        influencerId: assignment.influencerId,
        source: "TAG" as const,
        sourceRefId: assignment.tagId,
      })),
      unknownLabels,
    };
  }

  private async rowsFromInfluencers(
    tx: AudienceTx,
    campaignId: string,
    influencerIds: string[],
  ): Promise<AudienceRow[]> {
    const unique = Array.from(new Set(influencerIds));
    if (unique.length === 0) return [];
    const found = await tx.influencer.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((influencer) => influencer.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `인플루언서를 찾을 수 없습니다: ${missing.join(", ")}`,
      );
    }
    return unique.map((influencerId) => ({
      campaignId,
      influencerId,
      source: "MANUAL" as const,
      sourceRefId: null,
    }));
  }

  /** 해석된 행에 표시용 이름·출처 라벨을 붙인다. savedIds 에 없으면 pending. */
  private async hydrate(
    rows: AudienceRow[],
    savedIds: Set<string>,
  ): Promise<CampaignAudienceEntry[]> {
    if (rows.length === 0) return [];
    const [influencers, sourceLabels] = await Promise.all([
      this.prisma.influencer.findMany({
        where: { id: { in: rows.map((row) => row.influencerId) } },
        select: { id: true, name: true, email: true },
      }),
      this.loadSourceLabels(rows),
    ]);
    const byId = new Map(influencers.map((influencer) => [influencer.id, influencer]));
    return rows.flatMap((row) => {
      const influencer = byId.get(row.influencerId);
      // 해석 직후 탈퇴 등으로 사라진 인원 — 목록에서 조용히 뺀다(저장도 FK 로 막힌다).
      if (!influencer) return [];
      return [
        {
          influencerId: row.influencerId,
          name: influencer.name,
          email: influencer.email,
          source: row.source,
          sourceLabel: row.sourceRefId
            ? (sourceLabels.get(row.sourceRefId) ?? null)
            : null,
          pending: !savedIds.has(row.influencerId),
        },
      ];
    });
  }

  /**
   * sourceRefId → 사람이 읽는 이름. 캠페인 id 와 태그 id 는 서로 다른 테이블이지만
   * cuid 라 충돌하지 않으므로 한 맵에 담는다.
   */
  private async loadSourceLabels(
    rows: { source: CampaignAudienceSource; sourceRefId: string | null }[],
  ): Promise<Map<string, string>> {
    const campaignIds = rows
      .filter((row) => row.source === "CAMPAIGN" && row.sourceRefId !== null)
      .map((row) => row.sourceRefId as string);
    const tagIds = rows
      .filter((row) => row.source === "TAG" && row.sourceRefId !== null)
      .map((row) => row.sourceRefId as string);
    const labels = new Map<string, string>();
    if (campaignIds.length === 0 && tagIds.length === 0) return labels;

    const [campaigns, tags] = await Promise.all([
      campaignIds.length > 0
        ? this.prisma.campaign.findMany({
            where: { id: { in: Array.from(new Set(campaignIds)) } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      tagIds.length > 0
        ? this.prisma.influencerTag.findMany({
            where: { id: { in: Array.from(new Set(tagIds)) } },
            select: { id: true, label: true },
          })
        : Promise.resolve([]),
    ]);
    for (const campaign of campaigns) labels.set(campaign.id, campaign.title);
    for (const tag of tags) labels.set(tag.id, tag.label);
    return labels;
  }
}
