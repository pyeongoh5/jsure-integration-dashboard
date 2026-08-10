import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";

const TEST_ACTOR = { id: "admin-1", name: "테스트 어드민" };

type CampaignFindArgs = { where?: Record<string, unknown> };

function makeService(overrides: {
  onCreate?: (args: unknown) => void;
  onFindMany?: (args: CampaignFindArgs) => void;
  publishState?: "DRAFT" | "PUBLISHED";
  closedAt?: Date | null;
  hiddenAt?: Date | null;
  recruitEndAt?: Date;
  onUpdate?: (args: { data: Record<string, unknown> }) => void;
  onDelete?: (args: unknown) => void;
}) {
  const row = {
    id: "c1",
    category: "SNS",
    title: "제목",
    publishState: overrides.publishState ?? "DRAFT",
    rewardType: "UNIFIED",
    rewardJpy: 0,
    recruitStartAt: new Date("2026-07-28T00:00:00Z"),
    recruitEndAt: overrides.recruitEndAt ?? new Date("2026-07-28T00:00:00Z"),
    closedAt: overrides.closedAt ?? null,
    hiddenAt: overrides.hiddenAt ?? null,
    deletedAt: null,
    postingPeriodDays: 14,
    productSummary: "",
    productDetailUrls: [],
    guideline: "",
    referenceMediaUrls: [],
    cautions: "",
    thumbnailUrl: null,
    createdAt: new Date("2026-07-28T00:00:00Z"),
    updatedAt: new Date("2026-07-28T00:00:00Z"),
    recruits: [],
    exclusionsAsExcluding: [],
  };
  const prisma = {
    campaign: {
      create: async (args: unknown) => {
        overrides.onCreate?.(args);
        return row;
      },
      findMany: async (args: CampaignFindArgs) => {
        overrides.onFindMany?.(args);
        return [];
      },
      findUnique: async () => ({
        publishState: overrides.publishState ?? "DRAFT",
        closedAt: overrides.closedAt ?? null,
      }),
      findFirst: async () => row,
      update: async (args: { data: Record<string, unknown> }) => {
        overrides.onUpdate?.(args);
        return row;
      },
      delete: async (args: unknown) => {
        overrides.onDelete?.(args);
        return row;
      },
    },
    campaignApplication: {
      groupBy: async () => [],
      count: async () => 0,
    },
  } as never;
  const uploads = {
    resolveCampaignThumbnailUrl: async (value: string | null) => value,
    resolveR2ImagesInHtml: async (value: string) => value,
  } as never;
  const audit = {
    record: jest.fn(),
    recordMany: jest.fn(),
  } as never;
  return new CampaignsService(prisma, uploads, audit);
}

describe("임시저장 생성", () => {
  it("제목만 있으면 저장되고 미입력 필드는 기본값으로 채워진다", async () => {
    let created: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args as { data: Record<string, unknown> };
      },
    });

    await service.createDraft({ title: "작성 중인 캠페인" }, TEST_ACTOR);

    const data = created!.data;
    expect(data.publishState).toBe("DRAFT");
    expect(data.title).toBe("작성 중인 캠페인");
    expect(data.rewardJpy).toBe(0);
    expect(data.postingPeriodDays).toBe(14);
    expect(data.productSummary).toBe("");
    expect(data.productDetailUrls).toEqual([]);
    expect(data.recruitStartAt).toBeInstanceOf(Date);
    // 썸네일 미지정은 필드 자체를 보내지 않아 기존 값이 유지된다.
    expect("thumbnailUrl" in data).toBe(false);
  });

  it("미완성 모집 행의 정원/팔로워는 0 으로 저장된다", async () => {
    let created: { data: { recruits: { create: Record<string, unknown>[] } } } | null =
      null;
    const service = makeService({
      onCreate: (args) => {
        created = args as never;
      },
    });

    await service.createDraft(
      {
        title: "작성 중",
        recruits: [{ subType: "INSTAGRAM", recruitCount: null }],
      },
      TEST_ACTOR,
    );

    const recruit = created!.data.recruits.create[0]!;
    expect(recruit.recruitCount).toBe(0);
    expect(recruit.minFollowers).toBe(0);
  });
});

describe("발행 상태 가드", () => {
  it("이미 발행된 캠페인은 임시저장 갱신/발행이 막힌다", async () => {
    const service = makeService({ publishState: "PUBLISHED" });
    await expect(service.updateDraft("c1", { title: "x" }, TEST_ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("임시저장 캠페인은 종료할 수 없다", async () => {
    const service = makeService({ publishState: "DRAFT" });
    await expect(service.close("c1", TEST_ACTOR)).rejects.toThrow(BadRequestException);
  });
});

describe("어드민 캠페인 목록", () => {
  it("기본은 DRAFT 를 제외하고, includeDrafts 면 필터를 걸지 않는다", async () => {
    const seen: CampaignFindArgs[] = [];
    const service = makeService({ onFindMany: (args) => seen.push(args) });

    await service.findAll();
    await service.findAll(true);

    expect(seen[0]!.where).toEqual({
      publishState: "PUBLISHED",
      deletedAt: null,
    });
    expect(seen[1]!.where).toEqual({ deletedAt: null });
  });
});

describe("비공개 전환", () => {
  it("모집중 캠페인은 비공개로 전환할 수 없다", async () => {
    // 모집 종료일이 미래이고 정원 미충족이면 status=recruit.
    const service = makeService({
      publishState: "PUBLISHED",
      recruitEndAt: new Date("2099-01-01T00:00:00Z"),
    });

    await expect(service.hide("c1", TEST_ACTOR)).rejects.toThrow(BadRequestException);
  });

  it("모집 종료 캠페인은 hiddenAt 이 채워진다", async () => {
    let updated: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      publishState: "PUBLISHED",
      closedAt: new Date("2026-07-29T00:00:00Z"),
      onUpdate: (args) => {
        updated = args;
      },
    });

    await service.hide("c1", TEST_ACTOR);

    expect(updated!.data.hiddenAt).toBeInstanceOf(Date);
  });
});

describe("캠페인 삭제", () => {
  it("임시저장은 물리 삭제된다", async () => {
    let deleted: unknown = null;
    const service = makeService({
      publishState: "DRAFT",
      onDelete: (args) => {
        deleted = args;
      },
    });

    await service.remove("c1", TEST_ACTOR);

    expect(deleted).toEqual({ where: { id: "c1" } });
  });

  it("발행된 캠페인은 종료와 함께 논리 삭제된다", async () => {
    let updated: { data: Record<string, unknown> } | null = null;
    let deleted: unknown = null;
    const service = makeService({
      publishState: "PUBLISHED",
      onUpdate: (args) => {
        updated = args;
      },
      onDelete: (args) => {
        deleted = args;
      },
    });

    await service.remove("c1", TEST_ACTOR);

    expect(deleted).toBeNull();
    expect(updated!.data.deletedAt).toBeInstanceOf(Date);
    expect(updated!.data.closedAt).toBeInstanceOf(Date);
  });
});

/**
 * DRAFT 누출 방지 가드 — campaigns 모듈 밖에서 campaign 테이블을 조회하는 코드는
 * 반드시 PUBLISHED_CAMPAIGN_WHERE 를 함께 써야 한다. 새 조회 지점이 필터 없이
 * 추가되면 여기서 걸린다.
 */
describe("campaign 조회 지점의 DRAFT 필터", () => {
  const SRC_DIR = join(__dirname, "..");
  const QUERY_PATTERN =
    /this\.prisma\.campaign\.(findMany|findFirst|findUnique|count|aggregate)\(\s*\{([\s\S]{0,400}?)\}\s*\)/g;

  function collectServiceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        return entry === "campaigns" ? [] : collectServiceFiles(path);
      }
      return path.endsWith(".service.ts") ? [path] : [];
    });
  }

  it("campaigns 모듈 밖의 조회는 PUBLISHED_CAMPAIGN_WHERE 를 사용한다", () => {
    const offenders: string[] = [];
    for (const file of collectServiceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(QUERY_PATTERN)) {
        if (!match[2]!.includes("PUBLISHED_CAMPAIGN_WHERE")) {
          offenders.push(`${file}: ${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
