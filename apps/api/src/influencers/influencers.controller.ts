import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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

  /**
   * 탈퇴 처리 — PII 를 익명화하며 되돌릴 수 없다.
   * 파급이 큰 비가역 조치라 OWNER 만 할 수 있다 (화면도 OWNER 에게만 버튼을 보여주지만,
   * 최종 방어선은 여기다 — 직접 호출로 우회되면 안 된다).
   */
  @Post(":id/withdraw")
  @HttpCode(204)
  async withdraw(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    if (req.user.role !== "OWNER") {
      throw new ForbiddenException("탈퇴 처리는 OWNER 만 할 수 있습니다");
    }
    await this.svc.withdraw(id, req.user);
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
