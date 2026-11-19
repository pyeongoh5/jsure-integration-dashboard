import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  DailyActionAlertKindSchema,
  parseCampaignBoardFilterParams,
  SendDailyActionRemindersRequestSchema,
  type AdminCampaignBoardResponse,
  type AdminOverviewResponse,
  type DailyActionAlertKind,
  type DailyActionAlertTargetsResponse,
  type DailyActionAlertsResponse,
  type SendDailyActionRemindersRequest,
  type SendDailyActionRemindersResponse,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminCampaignBoardService } from "./admin-campaign-board.service";
import { AdminDailyAlertsService } from "./admin-daily-alerts.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/overview")
export class AdminOverviewController {
  constructor(
    private readonly svc: AdminOverviewService,
    private readonly board: AdminCampaignBoardService,
    private readonly alerts: AdminDailyAlertsService,
  ) {}

  @Get()
  stats(@Req() request: { user: AuthenticatedUser }): Promise<AdminOverviewResponse> {
    return this.svc.stats(request.user.id);
  }

  @Get("campaign-board")
  campaignBoard(@Query() query: Record<string, string>): Promise<AdminCampaignBoardResponse> {
    return this.board.board(parseCampaignBoardFilterParams(query));
  }

  @Get("daily-alerts")
  dailyAlerts(): Promise<DailyActionAlertsResponse> {
    return this.alerts.counts();
  }

  @Get("daily-alerts/:kind/targets")
  async dailyAlertTargets(
    @Param("kind", new ZodValidationPipe(DailyActionAlertKindSchema))
    kind: DailyActionAlertKind,
  ): Promise<DailyActionAlertTargetsResponse> {
    return { targets: await this.alerts.targets(kind) };
  }

  @Post("daily-alerts/:kind/reminders")
  async sendDailyAlertReminders(
    @Param("kind", new ZodValidationPipe(DailyActionAlertKindSchema))
    kind: DailyActionAlertKind,
    @Body(new ZodValidationPipe(SendDailyActionRemindersRequestSchema))
    body: SendDailyActionRemindersRequest,
  ): Promise<SendDailyActionRemindersResponse> {
    return {
      requestedCount: await this.alerts.sendReminders(kind, body.applicationIds),
    };
  }
}
