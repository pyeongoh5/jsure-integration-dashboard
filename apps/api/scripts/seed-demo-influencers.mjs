// 데모용 인플루언서를 DB 에 N 명 추가하는 스크립트.
// 사용법: cd apps/api && node scripts/seed-demo-influencers.mjs [count]
// 기본 count = 100. 같은 prefix(email demo###@example.com) 가 이미 있으면 skip.

import { PrismaClient } from "@prisma/client";

const count = Number(process.argv[2] ?? 100);
if (!Number.isInteger(count) || count <= 0 || count > 5000) {
  console.error("사용법: node scripts/seed-demo-influencers.mjs <count(1~5000)>");
  process.exit(1);
}

const prisma = new PrismaClient();

const SNS_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];

let created = 0;
let skipped = 0;

for (let i = 1; i <= count; i += 1) {
  const email = `demo${String(i).padStart(4, "0")}@example.com`;
  const snsType = SNS_TYPES[i % SNS_TYPES.length];

  const existing = await prisma.influencer.findUnique({ where: { email } });
  if (existing) {
    skipped += 1;
    continue;
  }

  await prisma.influencer.create({
    data: {
      email,
      name: `데모 인플루언서 ${i}`,
      nameKana: null,
      phone: "000-0000-0000",
      status: "ACTIVE",
      snsAccounts: {
        create: {
          snsType,
          handle: `demo_${i}`,
          followerCount: 1000 + ((i * 37) % 50000),
        },
      },
    },
  });
  created += 1;
  if (created % 20 === 0) {
    console.log(`[seed-demo-influencers] ${created}/${count} 생성`);
  }
}

console.log(
  `[seed-demo-influencers] 완료 — 신규 ${created}명, 기존 skip ${skipped}명`,
);
await prisma.$disconnect();
