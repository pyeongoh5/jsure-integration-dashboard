import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AdminOverviewResponse } from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminOverviewService } from "./admin-overview.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/overview")
export class AdminOverviewController {
  constructor(private readonly svc: AdminOverviewService) {}

  @Get()
  stats(): Promise<AdminOverviewResponse> {
    return this.svc.stats();
  }
}
