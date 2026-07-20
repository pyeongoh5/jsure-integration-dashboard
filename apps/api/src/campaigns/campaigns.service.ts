import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OPTION_SELECTABLE_SUB_TYPES,
  SLOT_CONSUMING_STATUSES,
  SUB_TYPE_LABEL,
  type ApplicationStatus,
  type CampaignCategory,
  type CampaignResponse,
  type CreateCampaignRequest,
  type CampaignRecruit,
  type RewardType,
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

type RecruitOptionConfigInput = {
  option: string;
  recruitCount: number | null;
  rewardJpy: number | null;
};

type NormalizedRecruitInput = {
  subType: CampaignRecruit["subType"];
  minFollowers: number;
  recruitCount: number;
  rewardJpy: number | null;
  subTypeOptions: string[];
  insightRequired: boolean;
  isRequired: boolean;
  productPriceJpy: number | null;
  productUrl: string | null;
  options: RecruitOptionConfigInput[];
};

/** normalize 결과를 prisma nested create 형태로 변환. */
function toRecruitCreateData(recruit: NormalizedRecruitInput) {
  const { options, ...scalar } = recruit;
  return {
    ...scalar,
    options: options.length > 0 ? { create: options } : undefined,
  };
}

/** recruit 가 옵션별 보수 분리를 사용하는지 (모든 옵션 행에 rewardJpy 존재). */
export function usesOptionRewardSplit(recruit: {
  options: { rewardJpy: number | null }[];
}): boolean {
  return (
    recruit.options.length > 0 &&
    recruit.options.every((option) => option.rewardJpy !== null)
  );
}

/** 서브타입별 보수 금액이 보수 체계와 일치하는지 서버 측 검증. */
export function validateRecruitsForRewardType(
  rewardType: RewardType,
  recruits: {
    subType: string;
    rewardJpy: number | null;
    options: RecruitOptionConfigInput[];
  }[],
): void {
  for (const recruit of recruits) {
    const optionRewardSplit = usesOptionRewardSplit(recruit);
    if (rewardType === "PER_SUBTYPE") {
      if (recruit.rewardJpy === null && !optionRewardSplit) {
        throw new BadRequestException(
          `개별 보수 캠페인에서는 ${recruit.subType} 모집의 보수 금액을 입력해야 합니다`,
        );
      }
      // 보수 분리 시 부모 보수는 null 강제 — 응모는 옵션 1개만 고르므로
      // 서브타입 보수에 어떤 대표값을 남겨도 거짓이 된다.
      if (recruit.rewardJpy !== null && optionRewardSplit) {
        throw new BadRequestException(
          "옵션별 보수 사용 시 서브타입 보수는 비워야 합니다",
        );
      }
    } else {
      if (recruit.rewardJpy !== null) {
        throw new BadRequestException(
          "통합 보수 캠페인에서는 서브타입별 보수를 지정할 수 없습니다",
        );
      }
      if (recruit.options.some((option) => option.rewardJpy !== null)) {
        throw new BadRequestException(
          "통합 보수 캠페인에서는 옵션별 보수를 지정할 수 없습니다",
        );
      }
    }
  }
}

/**
 * 옵션별 정원·보수 설정 검증 — 옵션 행 집합은 subTypeOptions 전체와 1:1,
 * recruitCount/rewardJpy 는 속성별 all-or-nothing.
 */
export function validateRecruitOptionConfigs(
  recruits: {
    subType: string;
    subTypeOptions: string[];
    options: RecruitOptionConfigInput[];
  }[],
): void {
  for (const recruit of recruits) {
    if (recruit.options.length === 0) continue;
    if (!OPTION_SELECTABLE_SUB_TYPES.includes(recruit.subType as never)) {
      throw new BadRequestException(
        `${recruit.subType} 모집에서는 옵션별 설정을 사용할 수 없습니다`,
      );
    }
    const names = recruit.options.map((option) => option.option);
    const nameSet = new Set(names);
    const allowedSet = new Set(recruit.subTypeOptions);
    const sameAsAllowed =
      nameSet.size === names.length &&
      nameSet.size === allowedSet.size &&
      names.every((name) => allowedSet.has(name));
    if (!sameAsAllowed) {
      throw new BadRequestException(
        "옵션별 설정은 모집하는 모든 옵션과 정확히 일치해야 합니다",
      );
    }
    const withCount = recruit.options.filter(
      (option) => option.recruitCount !== null,
    );
    if (withCount.length !== 0 && withCount.length !== recruit.options.length) {
      throw new BadRequestException(
        "옵션별 정원은 전부 입력하거나 전부 비워야 합니다",
      );
    }
    if (withCount.some((option) => (option.recruitCount ?? 0) < 1)) {
      throw new BadRequestException("옵션별 정원은 1 이상이어야 합니다");
    }
    const withReward = recruit.options.filter(
      (option) => option.rewardJpy !== null,
    );
    if (
      withReward.length !== 0 &&
      withReward.length !== recruit.options.length
    ) {
      throw new BadRequestException(
        "옵션별 보수는 전부 입력하거나 전부 비워야 합니다",
      );
    }
    if (withCount.length === 0 && withReward.length === 0) {
      throw new BadRequestException(
        "옵션별 설정에는 정원 또는 보수를 입력해야 합니다",
      );
    }
  }
}

type CampaignRecruitRow = {
  subType: string;
  minFollowers: number;
  recruitCount: number;
  rewardJpy: number | null;
  subTypeOptions: string[];
  insightRequired: boolean;
  isRequired: boolean;
  productPriceJpy: number | null;
  productUrl: string | null;
  options: RecruitOptionConfigInput[];
};

type CampaignRow = {
  id: string;
  category: CampaignCategory;
  title: string;
  rewardType: RewardType;
  rewardJpy: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  closedAt: Date | null;
  postingPeriodDays: number;
  productSummary: string;
  productDetailUrls: string[];
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
    rewardType: row.rewardType,
    rewardJpy: row.rewardJpy,
    recruits: row.recruits.map((recruit) => ({
      subType: recruit.subType as CampaignRecruit["subType"],
      minFollowers: recruit.minFollowers,
      recruitCount: recruit.recruitCount,
      rewardJpy: recruit.rewardJpy,
      subTypeOptions: recruit.subTypeOptions,
      insightRequired: recruit.insightRequired,
      isRequired: recruit.isRequired,
      productPriceJpy: recruit.productPriceJpy,
      productUrl: recruit.productUrl,
      options: recruit.options.map((option) => ({
        option: option.option,
        recruitCount: option.recruitCount,
        rewardJpy: option.rewardJpy,
      })),
    })),
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    postingPeriodDays: row.postingPeriodDays,
    productSummary: row.productSummary,
    productDetailUrls: row.productDetailUrls,
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
      rewardJpy: true,
      subTypeOptions: true,
      insightRequired: true,
      isRequired: true,
      productPriceJpy: true,
      productUrl: true,
      options: {
        select: { option: true, recruitCount: true, rewardJpy: true },
        orderBy: { option: "asc" as const },
      },
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
    validateRecruitsForRewardType(input.rewardType, recruits);
    validateRecruitOptionConfigs(recruits);
    const row = await this.prisma.campaign.create({
      data: {
        category: input.category,
        title: input.title,
        rewardType: input.rewardType,
        rewardJpy: input.rewardJpy,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        postingPeriodDays: input.postingPeriodDays,
        productSummary: input.productSummary,
        productDetailUrls: input.productDetailUrls,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        cautions: input.cautions,
        thumbnailUrl: input.thumbnailUrl ?? null,
        recruits: {
          create: recruits.map((recruit) => toRecruitCreateData(recruit)),
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
  ): NormalizedRecruitInput[] {
    return recruits.map((recruit) => {
      const options: RecruitOptionConfigInput[] = (recruit.options ?? []).map(
        (option) => ({
          option: option.option,
          recruitCount: option.recruitCount ?? null,
          rewardJpy: option.rewardJpy ?? null,
        }),
      );
      // 정원 분리 시 부모 recruitCount 는 옵션 정원 합계로 저장 —
      // 카드 합산·전체 마감 판정 등 기존 참조가 그대로 동작한다.
      const countSplit =
        options.length > 0 &&
        options.every((option) => option.recruitCount !== null);
      const recruitCount = countSplit
        ? options.reduce((sum, option) => sum + (option.recruitCount ?? 0), 0)
        : recruit.recruitCount;
      const base = {
        subType: recruit.subType,
        minFollowers: recruit.minFollowers,
        recruitCount,
        rewardJpy: recruit.rewardJpy ?? null,
        insightRequired: recruit.insightRequired ?? true,
        isRequired: recruit.isRequired ?? false,
        productPriceJpy: recruit.productPriceJpy ?? null,
        productUrl: recruit.productUrl ?? null,
        options,
      };
      const unique = Array.from(new Set(recruit.subTypeOptions ?? []));
      if (recruit.subType === "INSTAGRAM") {
        if (unique.length === 0) {
          throw new BadRequestException(
            "Instagram 모집은 FEED/REELS 중 1개 이상을 선택해야 합니다",
          );
        }
        return { ...base, subTypeOptions: unique };
      }
      if (recruit.subType === "QOO10") {
        return { ...base, subTypeOptions: unique };
      }
      return { ...base, subTypeOptions: [] };
    });
  }

  /**
   * 옵션별 보수 분리 활성화 불변식: 해당 서브타입으로 참여한 기존 유효 응모
   * 전부에 옵션 선택이 있어야 한다. 없으면 정산 시 금액 미정 응모가 생기므로
   * 캠페인 저장 시점에 차단한다.
   */
  private async assertOptionRewardSplitAllowed(
    tx: {
      campaignApplication: {
        count: (args: {
          where: Record<string, unknown>;
        }) => Promise<number>;
      };
    },
    campaignId: string,
    recruits: NormalizedRecruitInput[],
  ): Promise<void> {
    for (const recruit of recruits) {
      if (!usesOptionRewardSplit(recruit)) continue;
      const missingOption = await tx.campaignApplication.count({
        where: {
          campaignId,
          subTypes: { has: recruit.subType },
          status: { not: "CANCELLED" },
          options: { none: { subType: recruit.subType } },
        },
      });
      if (missingOption > 0) {
        throw new BadRequestException(
          `${SUB_TYPE_LABEL[recruit.subType]} 옵션별 보수를 사용하려면 기존 응모 전체에 옵션 선택이 있어야 합니다 (미선택 응모 ${missingOption}건)`,
        );
      }
    }
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
    if (input.rewardType !== undefined) data.rewardType = input.rewardType;
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
    if (input.productDetailUrls !== undefined) data.productDetailUrls = input.productDetailUrls;
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
        validateRecruitsForRewardType(
          input.rewardType ?? existing.rewardType,
          normalized,
        );
        validateRecruitOptionConfigs(normalized);
        await this.assertOptionRewardSplitAllowed(tx, id, normalized);
        await tx.campaignRecruit.deleteMany({ where: { campaignId: id } });
        for (const recruit of normalized) {
          await tx.campaignRecruit.create({
            data: { campaignId: id, ...toRecruitCreateData(recruit) },
          });
        }
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
