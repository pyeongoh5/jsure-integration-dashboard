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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 기본 조회 기간(일). 화면 기본값과 같아야 한다. */
const DEFAULT_PERIOD_DAYS = 7;

/**
 * 기간은 필수다 — 없거나 형식이 틀리면 최근 7일로 본다.
 * 전 기간 조회는 허용하지 않는다: 응모·게시물까지 읽어 집계하므로 타임아웃 난다.
 */
function resolvePeriod(from?: string, to?: string): { from: string; to: string } {
  if (from && to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to)) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const end = jstNow.toISOString().slice(0, 10);
  const start = new Date(jstNow);
  start.setUTCDate(start.getUTCDate() - (DEFAULT_PERIOD_DAYS - 1));
  return { from: start.toISOString().slice(0, 10), to: end };
}

@UseGuards(JwtAuthGuard)
@Controller("admin/reports")
export class AdminReportsController {
  constructor(private readonly svc: AdminReportsService) {}

  @Get("campaigns")
  campaigns(
    @Query("from") from?: string,
    @Query("to") to?: string,
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
    return this.svc.campaignReports(sortKey, sortOrder, resolvePeriod(from, to));
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
