import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ChangeMyPasswordRequestSchema,
  UpdateAdminTestLineUserIdRequestSchema,
  type ChangeMyPasswordRequest,
  type PasswordChangedResponse,
  type UpdateAdminTestLineUserIdRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminUsersService } from "../admin-users/admin-users.service";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/me")
export class AdminMeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminUsers: AdminUsersService,
  ) {}

  /** 본인 비밀번호 변경. 현재 세션만 남기고 다른 기기의 세션은 끊는다. */
  @Post("password")
  @HttpCode(200)
  async changePassword(
    @Body(new ZodValidationPipe(ChangeMyPasswordRequestSchema))
    input: ChangeMyPasswordRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<PasswordChangedResponse> {
    const verified = await this.adminUsers.verifyPassword(
      req.user.id,
      input.currentPassword,
    );
    if (!verified) {
      // 401 로 내리면 웹의 axios 인터셉터가 토큰 만료로 오해해 로그아웃시킨다.
      throw new BadRequestException("현재 비밀번호가 일치하지 않습니다");
    }
    await this.adminUsers.setPassword(
      req.user.id,
      input.newPassword,
      req.user.sid,
    );
    return { ok: true };
  }

  @Patch("test-line-user-id")
  async updateTestLineUserId(
    @Body(new ZodValidationPipe(UpdateAdminTestLineUserIdRequestSchema))
    input: UpdateAdminTestLineUserIdRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<{ testLineUserId: string | null }> {
    const updated = await this.prisma.adminUser.update({
      where: { id: req.user.id },
      data: { testLineUserId: input.testLineUserId },
      select: { testLineUserId: true },
    });
    return updated;
  }
}
