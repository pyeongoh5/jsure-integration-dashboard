import * as bcrypt from "bcrypt";
import { AdminUsersService } from "./admin-users.service";

type Captured = {
  userUpdate: { where: { id: string }; data: { passwordHash: string } };
  sessionUpdateMany: {
    where: Record<string, unknown>;
    data: { revokedAt: Date };
  };
};

function makeService(storedHash: string | null) {
  const captured: Partial<Captured> = {};
  const prisma = {
    adminUser: {
      findUnique: async () =>
        storedHash === null ? null : { passwordHash: storedHash },
      update: (args: Captured["userUpdate"]) => {
        captured.userUpdate = args;
        return args;
      },
    },
    adminUserSession: {
      updateMany: (args: Captured["sessionUpdateMany"]) => {
        captured.sessionUpdateMany = args;
        return args;
      },
    },
    $transaction: async (operations: unknown[]) => operations,
  } as never;
  return { service: new AdminUsersService(prisma), captured };
}

describe("AdminUsersService.verifyPassword", () => {
  it("현재 비밀번호가 맞으면 true", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    const { service } = makeService(hash);
    expect(await service.verifyPassword("admin-1", "correct-horse")).toBe(true);
  });

  it("틀리면 false", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    const { service } = makeService(hash);
    expect(await service.verifyPassword("admin-1", "wrong")).toBe(false);
  });

  it("없는 계정이면 false", async () => {
    const { service } = makeService(null);
    expect(await service.verifyPassword("nobody", "whatever")).toBe(false);
  });
});

describe("AdminUsersService.setPassword", () => {
  it("새 비밀번호를 해시로 저장하고 현재 세션만 남긴다", async () => {
    const { service, captured } = makeService(null);
    await service.setPassword("admin-1", "brand-new-pw", "sess-current");

    const savedHash = captured.userUpdate?.data.passwordHash ?? "";
    expect(savedHash).not.toBe("brand-new-pw");
    expect(await bcrypt.compare("brand-new-pw", savedHash)).toBe(true);
    expect(captured.sessionUpdateMany?.where).toMatchObject({
      adminUserId: "admin-1",
      revokedAt: null,
      id: { not: "sess-current" },
    });
  });

  it("남길 세션이 없으면(OWNER 대행 재설정) 모든 세션을 무효화한다", async () => {
    const { service, captured } = makeService(null);
    await service.setPassword("admin-2", "brand-new-pw", null);

    expect(captured.sessionUpdateMany?.where).toEqual({
      adminUserId: "admin-2",
      revokedAt: null,
    });
  });
});
