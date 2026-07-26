import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export * from '@prisma/client';

let prisma: PrismaClient | undefined;

/** 프로세스 전역 싱글턴 PrismaClient (엔진리스 — pg driver adapter, Neon 호환) */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
