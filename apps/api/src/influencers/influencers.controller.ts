import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CreateInfluencerMemoRequestSchema,
  type AdminInfluencerListResponse,
  type CreateInfluencerMemoRequest,
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
  async list(): Promise<AdminInfluencerListResponse> {
    const influencers = await this.svc.listForAdmin();
    return { influencers };
  }

  @Get(":id/notes")
  notes(@Param("id") id: string): Promise<InfluencerNotesResponse> {
    return this.svc.getNotes(id);
  }

  @Post(":id/memos")
  @HttpCode(201)
  createMemo(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateInfluencerMemoRequestSchema))
    body: CreateInfluencerMemoRequest,
  ): Promise<InfluencerMemoEntry> {
    return this.svc.createMemo(id, req.user.id, body.comment.trim());
  }

  @Post(":id/flag")
  @HttpCode(200)
  flag(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<{ flaggedAt: string }> {
    return this.svc.setFlagged(id, req.user.id);
  }

  @Delete(":id/flag")
  @HttpCode(204)
  async unflag(@Param("id") id: string): Promise<void> {
    await this.svc.clearFlagged(id);
  }
}
