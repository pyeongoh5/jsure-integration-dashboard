import { Body, Controller, Patch, Req, UseGuards } from "@nestjs/common";
import {
  UpdateAdminTestLineUserIdRequestSchema,
  type UpdateAdminTestLineUserIdRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/me")
export class AdminMeController {
  constructor(private readonly prisma: PrismaService) {}

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
