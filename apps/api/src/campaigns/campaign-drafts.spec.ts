import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";

type CampaignFindArgs = { where?: Record<string, unknown> };

function makeService(overrides: {
  onCreate?: (args: unknown) => void;
  onFindMany?: (args: CampaignFindArgs) => void;
  publishState?: "DRAFT" | "PUBLISHED";
  closedAt?: Date | null;
}) {
  const row = {
    id: "c1",
    category: "SNS",
    title: "제목",
    publishState: overrides.publishState ?? "DRAFT",
    rewardType: "UNIFIED",
    rewardJpy: 0,
    recruitStartAt: new Date("2026-07-28T00:00:00Z"),
    recruitEndAt: new Date("2026-07-28T00:00:00Z"),
    closedAt: overrides.closedAt ?? null,
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
      update: async () => row,
    },
    campaignApplication: {
      groupBy: async () => [],
    },
  } as never;
  const uploads = {
    resolveCampaignThumbnailUrl: async (value: string | null) => value,
    resolveR2ImagesInHtml: async (value: string) => value,
  } as never;
  return new CampaignsService(prisma, uploads);
}

describe("임시저장 생성", () => {
  it("제목만 있으면 저장되고 미입력 필드는 기본값으로 채워진다", async () => {
    let created: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args as { data: Record<string, unknown> };
      },
    });

    await service.createDraft({ title: "작성 중인 캠페인" });

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

    await service.createDraft({
      title: "작성 중",
      recruits: [{ subType: "INSTAGRAM", recruitCount: null }],
    });

    const recruit = created!.data.recruits.create[0]!;
    expect(recruit.recruitCount).toBe(0);
    expect(recruit.minFollowers).toBe(0);
  });
});

describe("발행 상태 가드", () => {
  it("이미 발행된 캠페인은 임시저장 갱신/발행/삭제가 막힌다", async () => {
    const service = makeService({ publishState: "PUBLISHED" });
    await expect(service.updateDraft("c1", { title: "x" })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.deleteDraft("c1")).rejects.toThrow(BadRequestException);
  });

  it("임시저장 캠페인은 종료할 수 없다", async () => {
    const service = makeService({ publishState: "DRAFT" });
    await expect(service.close("c1")).rejects.toThrow(BadRequestException);
  });
});

describe("어드민 캠페인 목록", () => {
  it("기본은 DRAFT 를 제외하고, includeDrafts 면 필터를 걸지 않는다", async () => {
    const seen: CampaignFindArgs[] = [];
    const service = makeService({ onFindMany: (args) => seen.push(args) });

    await service.findAll();
    await service.findAll(true);

    expect(seen[0]!.where).toEqual({ publishState: "PUBLISHED" });
    expect(seen[1]!.where).toBeUndefined();
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
