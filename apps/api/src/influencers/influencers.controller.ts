import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CreateInfluencerMemoRequestSchema,
  parseInfluencerFilterParams,
  type AdminInfluencerExportResponse,
  type AdminInfluencerPageResponse,
  type CreateInfluencerMemoRequest,
  type InfluencerActivityResponse,
  type InfluencerMemoEntry,
  type InfluencerNotesResponse,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { InfluencersService } from "./influencers.service";

@UseGuards(JwtAuthGuard)
@Controller("influencers")
export class InfluencersController {
  constructor(private readonly svc: InfluencersService) {}

  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<AdminInfluencerPageResponse> {
    const limit = Number(query.limit);
    return this.svc.listForAdminPage(
      parseInfluencerFilterParams(query),
      query.cursor?.trim() || null,
      Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 30,
    );
  }

  @Get("export")
  exportAll(
    @Query() query: Record<string, string>,
  ): Promise<AdminInfluencerExportResponse> {
    return this.svc.exportForAdmin(parseInfluencerFilterParams(query));
  }

  @Get(":id/notes")
  notes(@Param("id") id: string): Promise<InfluencerNotesResponse> {
    return this.svc.getNotes(id);
  }

  @Get(":id/activity")
  activity(@Param("id") id: string): Promise<InfluencerActivityResponse> {
    return this.svc.getActivity(id);
  }

  @Post(":id/memos")
  @HttpCode(201)
  createMemo(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateInfluencerMemoRequestSchema))
    body: CreateInfluencerMemoRequest,
  ): Promise<InfluencerMemoEntry> {
    return this.svc.createMemo(
      id,
      req.user,
      body.comment.trim(),
      body.campaignId ?? null,
    );
  }

  @Post(":id/flag")
  @HttpCode(200)
  flag(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<{ flaggedAt: string }> {
    return this.svc.setFlagged(id, req.user);
  }

  @Delete(":id/flag")
  @HttpCode(204)
  async unflag(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    await this.svc.clearFlagged(id, req.user);
  }
}
