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
   * 세 경로를 해석해 대상자 행을 **추가**한다(교체가 아니다).
   *
   * 교체하지 않는 이유: 어드민이 대상자 목록에서 개별 삭제한 사람이 다음 저장 때
   * 되살아나면 "뺐는데 다시 들어온다"가 된다. 제거는 목록 화면의 삭제로만 한다.
   */
  async addFromInput(
    tx: AudienceTx,
    campaignId: string,
    input: CampaignAudienceInput,
  ): Promise<void> {
    if (!hasAudienceInput(input)) return;

    const { rows, unknownTagLabels } = await this.resolve(tx, campaignId, input);
    if (unknownTagLabels.length > 0) {
      throw new NotFoundException(
        `등록되지 않은 인플루언서 태그입니다: ${unknownTagLabels.join(", ")}`,
      );
    }
    if (rows.length === 0) return;

    await tx.campaignAudience.createMany({ data: rows, skipDuplicates: true });
  }

  /**
   * 저장 전 프리뷰 — 이미 등록된 대상자와 이번에 추가될 인원을 합쳐 보여준다.
   * 저장과 같은 resolve() 를 쓰므로 "프리뷰에는 있는데 저장하면 없다"가 생기지 않는다.
   */
  async preview(
    campaignId: string | null,
    input: CampaignAudienceInput,
  ): Promise<{
    audience: CampaignAudienceEntry[];
    unknownTagLabels: string[];
  }> {
    const [saved, resolved] = await Promise.all([
      campaignId ? this.loadSavedRows(campaignId) : Promise.resolve([]),
      this.resolve(this.prisma, campaignId ?? "", input),
    ]);

    const savedIds = new Set(saved.map((entry) => entry.influencerId));
    const pendingRows = resolved.rows.filter(
      (row) => !savedIds.has(row.influencerId),
    );
    const pendingEntries = await this.hydrate(pendingRows, true);

    return {
      // 저장된 대상자가 먼저 — 아래쪽에 "이번에 추가될 인원"이 쌓이는 모양이 읽기 쉽다.
      audience: [...saved, ...pendingEntries],
      unknownTagLabels: resolved.unknownTagLabels,
    };
  }

  /** 어드민 대상자 목록(저장된 것만). */
  async list(campaignId: string): Promise<CampaignAudienceEntry[]> {
    return this.loadSavedRows(campaignId);
  }

  /** 대상자 1명 제외. 이미 없으면 조용히 끝낸다(중복 클릭 방어). */
  async remove(campaignId: string, influencerId: string): Promise<void> {
    await this.prisma.campaignAudience.deleteMany({
      where: { campaignId, influencerId },
    });
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

  private async loadSavedRows(
    campaignId: string,
  ): Promise<CampaignAudienceEntry[]> {
    const rows = await this.prisma.campaignAudience.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
      select: {
        influencerId: true,
        source: true,
        sourceRefId: true,
        createdAt: true,
        influencer: { select: { name: true, email: true } },
      },
    });
    const sourceLabels = await this.loadSourceLabels(rows);
    return rows.map((row) => ({
      influencerId: row.influencerId,
      name: row.influencer.name,
      email: row.influencer.email,
      source: row.source,
      sourceLabel: row.sourceRefId
        ? (sourceLabels.get(row.sourceRefId) ?? null)
        : null,
      pending: false,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** 아직 저장 전인 행에 표시용 이름·출처 라벨을 붙인다. */
  private async hydrate(
    rows: AudienceRow[],
    pending: boolean,
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
          pending,
          createdAt: null,
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
