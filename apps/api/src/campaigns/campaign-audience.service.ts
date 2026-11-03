import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  type CampaignAudienceEntry,
  type CampaignAudienceSource,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

/** 세 경로의 대상자 지정 입력. 함께 쓸 수 있고 결과는 합집합이다. */
export type AudienceInput = {
  audienceCampaignIds: string[];
  audienceTagLabels: string[];
  audienceInfluencerIds: string[];
};

type AudienceRow = {
  campaignId: string;
  influencerId: string;
  source: CampaignAudienceSource;
  sourceRefId: string | null;
};

/** 대상자 추가에 쓰는 트랜잭션 클라이언트 — 캠페인 생성/수정 트랜잭션 안에서 호출된다. */
type AudienceTx = Pick<
  PrismaService,
  "campaignApplication" | "influencerTag" | "influencerTagAssignment" | "influencer" | "campaignAudience"
>;

export function hasAudienceInput(input: AudienceInput): boolean {
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
    input: AudienceInput,
  ): Promise<void> {
    if (!hasAudienceInput(input)) return;

    const rows: AudienceRow[] = [
      ...(await this.rowsFromCampaigns(tx, campaignId, input.audienceCampaignIds)),
      ...(await this.rowsFromTags(tx, campaignId, input.audienceTagLabels)),
      ...(await this.rowsFromInfluencers(tx, campaignId, input.audienceInfluencerIds)),
    ];

    // 같은 사람이 여러 경로로 걸릴 수 있다. 복합 PK 가 DB 에서도 막아주지만,
    // 먼저 잡힌 출처를 남기려면 여기서 순서대로 한 번 걸러야 한다.
    const deduped = new Map<string, AudienceRow>();
    for (const row of rows) {
      if (!deduped.has(row.influencerId)) deduped.set(row.influencerId, row);
    }
    if (deduped.size === 0) return;

    await tx.campaignAudience.createMany({
      data: Array.from(deduped.values()),
      skipDuplicates: true,
    });
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

  /**
   * 관리 태그가 달린 인플루언서. 등록되지 않은 라벨은 거절한다 —
   * 오타 하나로 대상자 0명인 캠페인이 조용히 만들어지는 쪽이 더 위험하다.
   */
  private async rowsFromTags(
    tx: AudienceTx,
    campaignId: string,
    tagLabels: string[],
  ): Promise<AudienceRow[]> {
    const unique = Array.from(new Set(tagLabels));
    if (unique.length === 0) return [];
    const tags = await tx.influencerTag.findMany({
      where: { label: { in: unique } },
      select: { id: true, label: true },
    });
    const foundLabels = new Set(tags.map((tag) => tag.label));
    const missing = unique.filter((label) => !foundLabels.has(label));
    if (missing.length > 0) {
      throw new NotFoundException(
        `등록되지 않은 인플루언서 태그입니다: ${missing.join(", ")}`,
      );
    }
    const assignments = await tx.influencerTagAssignment.findMany({
      where: { tagId: { in: tags.map((tag) => tag.id) } },
      select: { influencerId: true, tagId: true },
    });
    return assignments.map((assignment) => ({
      campaignId,
      influencerId: assignment.influencerId,
      source: "TAG" as const,
      sourceRefId: assignment.tagId,
    }));
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

  /** 어드민 대상자 목록. 출처(캠페인 제목·태그 라벨)까지 붙여 내려준다. */
  async list(campaignId: string): Promise<CampaignAudienceEntry[]> {
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
      createdAt: row.createdAt.toISOString(),
    }));
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

  /** 대상자 1명 제외. 이미 없으면 조용히 끝낸다(중복 클릭 방어). */
  async remove(campaignId: string, influencerId: string): Promise<void> {
    await this.prisma.campaignAudience.deleteMany({
      where: { campaignId, influencerId },
    });
  }
}
