import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AdminOverviewResponse } from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminOverviewService } from "./admin-overview.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/overview")
export class AdminOverviewController {
  constructor(private readonly svc: AdminOverviewService) {}

  @Get()
  stats(
    @Req() request: { user: AuthenticatedUser },
  ): Promise<AdminOverviewResponse> {
    return this.svc.stats(request.user.id);
  }
}
