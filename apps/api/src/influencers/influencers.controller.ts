import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AdminInfluencerListResponse } from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InfluencersService } from "./influencers.service";

@UseGuards(JwtAuthGuard)
@Controller("influencers")
export class InfluencersController {
  constructor(private readonly svc: InfluencersService) {}

  @Get()
  async list(): Promise<AdminInfluencerListResponse> {
    const influencers = await this.svc.listForAdmin();
    return { influencers };
  }
}
