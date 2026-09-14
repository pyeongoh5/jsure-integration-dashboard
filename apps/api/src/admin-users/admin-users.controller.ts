import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  ResetAdminUserPasswordRequestSchema,
  type ListAdminUsersResponse,
  type PasswordChangedResponse,
  type PublicAdminUser,
  type ResetAdminUserPasswordRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminUsersService } from "./admin-users.service";

const UpdateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "GUEST"]),
});
type UpdateRoleRequest = z.infer<typeof UpdateRoleSchema>;

@UseGuards(JwtAuthGuard)
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(): Promise<ListAdminUsersResponse> {
    const users = await this.adminUsers.findAllPublic();
    return { users };
  }

  /** OWNER 또는 ADMIN 만 승인/반려 가능 */
  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new ForbiddenException("권한이 없습니다");
    }
  }

  @Post(":id/approve")
  @HttpCode(200)
  approve(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<PublicAdminUser> {
    this.assertAdmin(req.user);
    return this.adminUsers.approve(id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<PublicAdminUser> {
    this.assertAdmin(req.user);
    return this.adminUsers.reject(id);
  }

  /**
   * 역할 변경.
   * - OWNER 만 OWNER 부여 가능
   * - 자기 자신은 변경 불가 (실수로 자신을 강등하는 사고 방지)
   */
  @Patch(":id/role")
  async updateRole(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) body: UpdateRoleRequest,
  ): Promise<PublicAdminUser> {
    this.assertAdmin(req.user);
    if (req.user.id === id) {
      throw new BadRequestException("자기 자신의 권한은 변경할 수 없습니다");
    }
    if (body.role === "OWNER" && req.user.role !== "OWNER") {
      throw new ForbiddenException("OWNER 권한은 OWNER 만 부여할 수 있습니다");
    }
    return this.adminUsers.updateRole(id, body.role);
  }

  /**
   * 비밀번호를 잊은 어드민을 위해 OWNER 가 임시 비밀번호를 발급한다.
   * 메일 발송 인프라가 없어 OWNER 가 직접 전달하는 것을 전제로 한다.
   * - OWNER 만 가능 (ADMIN 이 상위 계정을 탈취하는 경로가 되지 않도록)
   * - 대상의 기존 세션은 모두 무효화
   */
  @Post(":id/reset-password")
  @HttpCode(200)
  async resetPassword(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ResetAdminUserPasswordRequestSchema))
    body: ResetAdminUserPasswordRequest,
  ): Promise<PasswordChangedResponse> {
    if (req.user.role !== "OWNER") {
      throw new ForbiddenException("비밀번호 재설정은 OWNER 만 할 수 있습니다");
    }
    if (req.user.id === id) {
      throw new BadRequestException(
        "자신의 비밀번호는 비밀번호 변경에서 직접 바꿔주세요",
      );
    }
    await this.adminUsers.setPassword(id, body.newPassword, null);
    return { ok: true };
  }
}
