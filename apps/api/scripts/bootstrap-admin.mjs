// 최초 OWNER admin 계정을 1회 생성하는 부트스트랩 스크립트.
// 사용법: cd apps/api && node scripts/bootstrap-admin.mjs <email> <password> [name]
// 또는 환경변수: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
const name = process.argv[4] ?? process.env.ADMIN_NAME ?? null;

if (!email || !password) {
  console.error(
    "사용법: node scripts/bootstrap-admin.mjs <email> <password> [name]",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const existing = await prisma.adminUser.findUnique({ where: { email } });
if (existing) {
  // 이미 있는 사용자는 OWNER + ACTIVE 로 승격만
  await prisma.adminUser.update({
    where: { id: existing.id },
    data: { role: "OWNER", status: "ACTIVE" },
  });
  console.log(`[bootstrap-admin] 기존 사용자 ${email}을 OWNER/ACTIVE로 승격`);
} else {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role: "OWNER",
      status: "ACTIVE",
    },
  });
  console.log(`[bootstrap-admin] OWNER ${email} 생성 완료`);
}

await prisma.$disconnect();
