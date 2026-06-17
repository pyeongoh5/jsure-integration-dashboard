import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  CampaignReportSortKeySchema,
  CampaignReportSortOrderSchema,
  type CampaignParticipantsResponse,
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

  @Get("campaigns/:campaignId/participants")
  campaignParticipants(
    @Param("campaignId") campaignId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<CampaignParticipantsResponse> {
    const parsedPage = Number.parseInt(page ?? "0", 10);
    const parsedPageSize = Number.parseInt(pageSize ?? "20", 10);
    const safePage = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 0;
    const safePageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0 && parsedPageSize <= 10000
        ? parsedPageSize
        : 20;
    return this.svc.campaignParticipants(campaignId, safePage, safePageSize);
  }
}
