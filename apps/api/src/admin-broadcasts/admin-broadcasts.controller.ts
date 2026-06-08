import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  BroadcastMessageRequestSchema,
  type BroadcastJob,
  type BroadcastJobListResponse,
  type BroadcastMessageRequest,
  type BroadcastMessageResponse,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminBroadcastsService } from "./admin-broadcasts.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/broadcasts")
export class AdminBroadcastsController {
  constructor(private readonly svc: AdminBroadcastsService) {}

  @Post()
  send(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(BroadcastMessageRequestSchema))
    body: BroadcastMessageRequest,
  ): Promise<BroadcastMessageResponse> {
    return this.svc.createBroadcast(body, req.user.id);
  }

  @Get()
  async list(
    @Query("limit") limit?: string,
  ): Promise<BroadcastJobListResponse> {
    const jobs = await this.svc.listRecent(limit ? Number(limit) : 20);
    return { jobs };
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<BroadcastJob> {
    return this.svc.findById(id);
  }
}
