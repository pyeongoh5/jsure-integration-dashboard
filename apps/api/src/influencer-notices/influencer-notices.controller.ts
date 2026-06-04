import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type {
  InfluencerNoticeDetail,
  InfluencerNoticeListResponse,
} from "@jsure/shared";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import { InfluencerNoticesService } from "./influencer-notices.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("influencer/notices")
export class InfluencerNoticesController {
  constructor(private readonly svc: InfluencerNoticesService) {}

  @Get()
  list(): Promise<InfluencerNoticeListResponse> {
    return this.svc.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<InfluencerNoticeDetail> {
    return this.svc.get(id);
  }
}
