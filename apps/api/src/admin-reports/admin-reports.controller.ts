import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  CampaignReportSortKeySchema,
  CampaignReportSortOrderSchema,
  type CampaignReportResponse,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminReportsService } from "./admin-reports.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/reports")
export class AdminReportsController {
  constructor(private readonly svc: AdminReportsService) {}

  @Get("campaigns")
  campaigns(
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ): Promise<CampaignReportResponse> {
    const sortKey: CampaignReportSortKey =
      CampaignReportSortKeySchema.safeParse(sort).success
        ? (sort as CampaignReportSortKey)
        : "totalEngagement";
    const sortOrder: CampaignReportSortOrder =
      CampaignReportSortOrderSchema.safeParse(order).success
        ? (order as CampaignReportSortOrder)
        : "desc";
    return this.svc.campaignReports(sortKey, sortOrder);
  }
}
