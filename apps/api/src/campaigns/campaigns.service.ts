import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  type ApplicationStatus,
  type CampaignCategory,
  type CampaignResponse,
  type CreateCampaignRequest,
  type CampaignRecruit,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

export function jstDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

export function jstDayEndUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59+09:00`);
}

export function utcToJstDateStr(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const SNS_SUB_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
const FAKE_PURCHASE_SUB_TYPES = ["QOO10"] as const;
const SIMPLE_REVIEW_SUB_TYPES = ["LIPS", "ATCOSME"] as const;

const INSTAGRAM_POST_TYPES = ["FEED", "REELS"] as const;
const QOO10_REVIEW_CHANNELS = ["LIPS", "ATCOSME"] as const;

export function validateRecruitsForCategory(
  category: CampaignCategory,
  recruits: {
    subType: string;
    minFollowers?: number | null;
    insightRequired?: boolean;
    productPriceJpy: number | null;
    productUrl: string | null;
    subTypeOptions?: string[];
  }[],
): void {
  if (category === "FAKE_PURCHASE") {
    if (recruits.length !== 1) {
      throw new BadRequestException(
        "가구매 리뷰 캠페인에서는 QOO10 모집을 1건만 등록할 수 있습니다",
      );
    }
  }
  for (const recruit of recruits) {
    const rawOptions = recruit.subTypeOptions ?? [];
    if (category === "SNS") {
      if (
        !SNS_SUB_TYPES.includes(
          recruit.subType as (typeof SNS_SUB_TYPES)[number],
        )
      ) {
        throw new BadRequestException(
          `SNS 캠페인에서는 ${recruit.subType} 서브타입을 모집할 수 없습니다`,
        );
      }
      if (recruit.productPriceJpy !== null || recruit.productUrl !== null) {
        throw new BadRequestException(
          "SNS 캠페인에서는 상품 가격/상품 URL 을 지정할 수 없습니다",
        );
      }
      if (recruit.subType === "INSTAGRAM") {
        if (rawOptions.length === 0) {
          throw new BadRequestException(
            "INSTAGRAM 모집에서는 게시물 타입(FEED/REELS) 을 하나 이상 선택해야 합니다",
          );
        }
        for (const option of rawOptions) {
          if (
            !INSTAGRAM_POST_TYPES.includes(
              option as (typeof INSTAGRAM_POST_TYPES)[number],
            )
          ) {
            throw new BadRequestException(
              `INSTAGRAM 의 게시물 타입 값이 올바르지 않습니다: ${option}`,
            );
          }
        }
      } else if (rawOptions.length !== 0) {
        throw new BadRequestException(
          `${recruit.subType} 모집에서는 게시물 타입을 지정할 수 없습니다`,
        );
      }
    } else if (category === "FAKE_PURCHASE") {
      if (
        !FAKE_PURCHASE_SUB_TYPES.includes(
          recruit.subType as (typeof FAKE_PURCHASE_SUB_TYPES)[number],
        )
      ) {
        throw new BadRequestException(
          `가구매 리뷰 캠페인에서는 ${recruit.subType} 서브타입을 모집할 수 없습니다`,
        );
      }
      if (recruit.productPriceJpy == null || recruit.productPriceJpy <= 0) {
        throw new BadRequestException(
          "상품 가격은 0보다 큰 정수를 입력해야 합니다",
        );
      }
      if (!recruit.productUrl || recruit.productUrl.trim().length === 0) {
        throw new BadRequestException("상품 URL 을 입력해주세요");
      }
      if (!/^https:\/\//i.test(recruit.productUrl)) {
        throw new BadRequestException("상품 URL 은 https:// 로 시작해야 합니다");
      }
      if ((recruit.minFollowers ?? 0) !== 0) {
        throw new BadRequestException(
          "가구매 리뷰 캠페인의 최소 팔로워는 0 이어야 합니다",
        );
      }
      if (recruit.insightRequired === true) {
        throw new BadRequestException(
          "가구매 리뷰 캠페인에서는 인사이트 필수 여부를 활성화할 수 없습니다",
        );
      }
      for (const option of rawOptions) {
        if (
          !QOO10_REVIEW_CHANNELS.includes(
            option as (typeof QOO10_REVIEW_CHANNELS)[number],
          )
        ) {
          throw new BadRequestException(
            `QOO10 의 리뷰 채널 값이 올바르지 않습니다: ${option}`,
          );
        }
      }
    } else {
      if (
        !SIMPLE_REVIEW_SUB_TYPES.includes(
          recruit.subType as (typeof SIMPLE_REVIEW_SUB_TYPES)[number],
        )
      ) {
        throw new BadRequestException(
          `단순 리뷰 캠페인에서는 ${recruit.subType} 서브타입을 모집할 수 없습니다`,
        );
      }
      if (recruit.productPriceJpy !== null || recruit.productUrl !== null) {
        throw new BadRequestException(
          "단순 리뷰 캠페인에서는 상품 가격/상품 URL 을 지정할 수 없습니다",
        );
      }
      if ((recruit.minFollowers ?? 0) !== 0) {
        throw new BadRequestException(
          "단순 리뷰 캠페인의 최소 팔로워는 0 이어야 합니다",
        );
      }
      if (recruit.insightRequired === true) {
        throw new BadRequestException(
          "단순 리뷰 캠페인에서는 인사이트 필수 여부를 활성화할 수 없습니다",
        );
      }
      if (rawOptions.length !== 0) {
        throw new BadRequestException(
          "단순 리뷰 캠페인에서는 서브 옵션을 지정할 수 없습니다",
        );
      }
    }
  }
}

type CampaignRecruitRow = {
  subType: string;
  minFollowers: number;
  recruitCount: number;
  subTypeOptions: string[];
  insightRequired: boolean;
  isRequired: boolean;
  productPriceJpy: number | null;
  productUrl: string | null;
};

type CampaignRow = {
  id: string;
  category: CampaignCategory;
  title: string;
  rewardJpy: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  closedAt: Date | null;
  postingPeriodDays: number;
  productSummary: string;
  productDetailUrl: string;
  guideline: string;
  referenceMediaUrls: string[];
  cautions: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  recruits: CampaignRecruitRow[];
  exclusionsAsExcluding: { excludedCampaignId: string }[];
};

type CampaignCounts = { approvedCount: number; appliedCount: number };

const EMPTY_COUNTS: CampaignCounts = { approvedCount: 0, appliedCount: 0 };

// "응모한 인원"은 아직 검토 전(APPLIED)만 카운트.
// "모집된 인원" 계산은 shared 의 SLOT_CONSUMING_STATUSES 를 사용
// (승인 이후 흐름 전체: 승인/배송/주문제출/리뷰제출/완료).

function toResponse(row: CampaignRow, counts: CampaignCounts): CampaignResponse {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    rewardJpy: row.rewardJpy,
    recruits: row.recruits.map((recruit) => ({
      subType: recruit.subType as CampaignRecruit["subType"],
      minFollowers: recruit.minFollowers,
      recruitCount: recruit.recruitCount,
      subTypeOptions: recruit.subTypeOptions,
      insightRequired: recruit.insightRequired,
      isRequired: recruit.isRequired,
      productPriceJpy: recruit.productPriceJpy,
      productUrl: recruit.productUrl,
    })),
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    postingPeriodDays: row.postingPeriodDays,
    productSummary: row.productSummary,
    productDetailUrl: row.productDetailUrl,
    guideline: row.guideline,
    referenceMediaUrls: row.referenceMediaUrls,
    cautions: row.cautions,
    thumbnailUrl: row.thumbnailUrl,
    approvedCount: counts.approvedCount,
    appliedCount: counts.appliedCount,
    excludedCampaignIds: row.exclusionsAsExcluding.map((e) => e.excludedCampaignId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const RECRUITS_INCLUDE = {
  recruits: {
    select: {
      subType: true,
      minFollowers: true,
      recruitCount: true,
      subTypeOptions: true,
      insightRequired: true,
      isRequired: true,
      productPriceJpy: true,
      productUrl: true,
    },
    orderBy: { subType: "asc" as const },
  },
  exclusionsAsExcluding: {
    select: { excludedCampaignId: true },
  },
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private async withResolvedThumbnail(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    response.thumbnailUrl = await this.uploads.resolveCampaignThumbnailUrl(
      response.thumbnailUrl,
    );
    return response;
  }

  /**
   * 본문 (productSummary/guideline/cautions) 안의 r2: 이미지 키를
   * presigned URL 로 치환하고 data-r2-key 속성으로 보존.
   * 어드민 폼 재편집 시 round-trip 가능.
   */
  private async withResolved(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    await this.withResolvedThumbnail(response);
    await this.withResolvedRich(response);
    return response;
  }

  private async withResolvedRich(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    const [productSummary, guideline, cautions] = await Promise.all([
      this.uploads.resolveR2ImagesInHtml(response.productSummary),
      this.uploads.resolveR2ImagesInHtml(response.guideline),
      this.uploads.resolveR2ImagesInHtml(response.cautions),
    ]);
    response.productSummary = productSummary;
    response.guideline = guideline;
    response.cautions = cautions;
    return response;
  }

  private async loadCounts(
    campaignIds: string[],
  ): Promise<Map<string, CampaignCounts>> {
    const map = new Map<string, CampaignCounts>();
    if (campaignIds.length === 0) return map;
    for (const id of campaignIds) {
      map.set(id, { approvedCount: 0, appliedCount: 0 });
    }
    const grouped = await this.prisma.campaignApplication.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      const entry = map.get(g.campaignId);
      if (!entry) continue;
      const status = g.status as ApplicationStatus;
      if (SLOT_CONSUMING_STATUSES.includes(status)) {
        entry.approvedCount += g._count._all;
      } else if (status === "APPLIED") {
        entry.appliedCount += g._count._all;
      }
    }
    return map;
  }

  private async countsFor(id: string): Promise<CampaignCounts> {
    const map = await this.loadCounts([id]);
    return map.get(id) ?? EMPTY_COUNTS;
  }

  async create(input: CreateCampaignRequest): Promise<CampaignResponse> {
    const excludedCampaignIds = await this.validateExcludedCampaignIds(
      input.excludedCampaignIds,
    );
    const recruits = this.normalizeCampaignRecruitsInput(input.recruits);
    validateRecruitsForCategory(input.category, recruits);
    const row = await this.prisma.campaign.create({
      data: {
        category: input.category,
        title: input.title,
        rewardJpy: input.rewardJpy,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        postingPeriodDays: input.postingPeriodDays,
        productSummary: input.productSummary,
        productDetailUrl: input.productDetailUrl,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        cautions: input.cautions,
        thumbnailUrl: input.thumbnailUrl ?? null,
        recruits: {
          create: recruits,
        },
        exclusionsAsExcluding: {
          create: excludedCampaignIds.map((excludedCampaignId) => ({
            excludedCampaignId,
          })),
        },
      },
      include: RECRUITS_INCLUDE,
    });
    return this.withResolved(toResponse(row, EMPTY_COUNTS));
  }

  /**
   * 모집 입력을 DB 저장 형식으로 정규화한다.
   * - INSTAGRAM 모집은 subTypeOptions(FEED/REELS) 가 1개 이상이어야 한다.
   * - 그 외 SNS 서브타입은 subTypeOptions 를 빈 배열로 강제.
   * - QOO10 은 리뷰 채널(LIPS/ATCOSME) 을 0-2개 허용.
   */
  private normalizeCampaignRecruitsInput(
    recruits: CreateCampaignRequest["recruits"],
  ): {
    subType: CampaignRecruit["subType"];
    minFollowers: number;
    recruitCount: number;
    subTypeOptions: string[];
    insightRequired: boolean;
    isRequired: boolean;
    productPriceJpy: number | null;
    productUrl: string | null;
  }[] {
    return recruits.map((recruit) => {
      const insightRequired = recruit.insightRequired ?? true;
      const isRequired = recruit.isRequired ?? false;
      const productPriceJpy = recruit.productPriceJpy ?? null;
      const productUrl = recruit.productUrl ?? null;
      const unique = Array.from(new Set(recruit.subTypeOptions ?? []));
      if (recruit.subType === "INSTAGRAM") {
        if (unique.length === 0) {
          throw new BadRequestException(
            "Instagram 모집은 FEED/REELS 중 1개 이상을 선택해야 합니다",
          );
        }
        return {
          subType: recruit.subType,
          minFollowers: recruit.minFollowers,
          recruitCount: recruit.recruitCount,
          subTypeOptions: unique,
          insightRequired,
          isRequired,
          productPriceJpy,
          productUrl,
        };
      }
      if (recruit.subType === "QOO10") {
        return {
          subType: recruit.subType,
          minFollowers: recruit.minFollowers,
          recruitCount: recruit.recruitCount,
          subTypeOptions: unique,
          insightRequired,
          isRequired,
          productPriceJpy,
          productUrl,
        };
      }
      return {
        subType: recruit.subType,
        minFollowers: recruit.minFollowers,
        recruitCount: recruit.recruitCount,
        subTypeOptions: [],
        insightRequired,
        isRequired,
        productPriceJpy,
        productUrl,
      };
    });
  }

  /**
   * 입력된 제외 캠페인 id 의 중복 제거 + 실제 존재 여부 검증.
   * 빈 배열이면 그대로 빈 배열 반환.
   */
  private async validateExcludedCampaignIds(
    ids: string[] | undefined,
    selfId?: string,
  ): Promise<string[]> {
    const unique = Array.from(new Set(ids ?? [])).filter(
      (id) => id !== selfId,
    );
    if (unique.length === 0) return [];
    const found = await this.prisma.campaign.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const invalid = unique.filter((id) => !foundIds.has(id));
    if (invalid.length > 0) {
      throw new NotFoundException(
        `제외 대상 캠페인을 찾을 수 없습니다: ${invalid.join(", ")}`,
      );
    }
    return unique;
  }

  async findAll(): Promise<CampaignResponse[]> {
    const rows = await this.prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: RECRUITS_INCLUDE,
    });
    const counts = await this.loadCounts(rows.map((r) => r.id));
    return Promise.all(
      rows.map((row) =>
        this.withResolved(
          toResponse(row, counts.get(row.id) ?? EMPTY_COUNTS),
        ),
      ),
    );
  }

  async findById(id: string): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.findUnique({
      where: { id },
      include: RECRUITS_INCLUDE,
    });
    if (!row) throw new NotFoundException("Campaign not found");
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }

  async update(
    id: string,
    input: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campaign not found");

    const data: Record<string, unknown> = {};
    if (input.category !== undefined) data.category = input.category;
    if (input.title !== undefined) data.title = input.title;
    if (input.rewardJpy !== undefined) data.rewardJpy = input.rewardJpy;
    if (input.recruitStartDate !== undefined) {
      data.recruitStartAt = jstDayStartUtc(input.recruitStartDate);
    }
    if (input.recruitEndDate !== undefined) {
      data.recruitEndAt = jstDayEndUtc(input.recruitEndDate);
    }
    if (input.postingPeriodDays !== undefined) {
      data.postingPeriodDays = input.postingPeriodDays;
    }
    if (input.productSummary !== undefined) data.productSummary = input.productSummary;
    if (input.productDetailUrl !== undefined) data.productDetailUrl = input.productDetailUrl;
    if (input.guideline !== undefined) data.guideline = input.guideline;
    if (input.referenceMediaUrls !== undefined) data.referenceMediaUrls = input.referenceMediaUrls;
    if (input.cautions !== undefined) data.cautions = input.cautions;
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;

    const validatedExcluded =
      input.excludedCampaignIds !== undefined
        ? await this.validateExcludedCampaignIds(input.excludedCampaignIds, id)
        : null;

    // recruits / exclusions 는 전체 교체.
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.recruits !== undefined) {
        const normalized = this.normalizeCampaignRecruitsInput(input.recruits);
        validateRecruitsForCategory(existing.category, normalized);
        await tx.campaignRecruit.deleteMany({ where: { campaignId: id } });
        await tx.campaignRecruit.createMany({
          data: normalized.map((recruit) => ({
            campaignId: id,
            ...recruit,
          })),
        });
      }
      if (validatedExcluded !== null) {
        await tx.campaignExclusion.deleteMany({ where: { campaignId: id } });
        if (validatedExcluded.length > 0) {
          await tx.campaignExclusion.createMany({
            data: validatedExcluded.map((excludedCampaignId) => ({
              campaignId: id,
              excludedCampaignId,
            })),
          });
        }
      }
      return tx.campaign.update({
        where: { id },
        data,
        include: RECRUITS_INCLUDE,
      });
    });
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }

  async close(id: string): Promise<CampaignResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campaign not found");
    if (existing.closedAt) {
      throw new ConflictException("Campaign already closed");
    }
    const row = await this.prisma.campaign.update({
      where: { id },
      data: { closedAt: new Date() },
      include: RECRUITS_INCLUDE,
    });
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }
}
