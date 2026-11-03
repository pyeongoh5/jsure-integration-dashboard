import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CampaignAudiencePreviewRequestSchema,
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type CampaignAudienceListResponse,
  type CampaignAudiencePreviewRequest,
  type CampaignAudienceSelectionResponse,
  type CampaignListResponse,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CampaignsService } from "./campaigns.service";
import { CampaignAudienceService } from "./campaign-audience.service";

@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audience: CampaignAudienceService,
  ) {}

  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.create(body, req.user);
  }

  /** includeDrafts=1 은 어드민 캠페인 관리 화면 전용 — 임시저장을 함께 반환한다. */
  @Get()
  async list(
    @Query("includeDrafts") includeDrafts?: string,
  ): Promise<CampaignListResponse> {
    const campaigns = await this.campaigns.findAll(includeDrafts === "1");
    return { campaigns };
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.findById(id);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCampaignRequestSchema))
    body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body, req.user);
  }

  /**
   * 저장 전 대상자 프리뷰. 어드민 폼이 피커를 건드릴 때마다 호출해
   * "지금 저장하면 최종적으로 누가 대상인지"를 실시간으로 보여준다.
   * 조회만 하므로 POST 지만 아무것도 바꾸지 않는다(입력이 쿼리스트링에 담기엔 크다).
   */
  @Post("audience/preview")
  previewAudience(
    @Body(new ZodValidationPipe(CampaignAudiencePreviewRequestSchema))
    body: CampaignAudiencePreviewRequest,
  ): Promise<CampaignAudienceListResponse> {
    const { campaignId, ...input } = body;
    return this.audience.preview(campaignId, input);
  }

  /**
   * 저장된 대상자에서 거꾸로 복원한 규칙 — 수정 화면이 피커를 기선택 상태로 그린다.
   * 캠페인 응답에 섞지 않는 이유: 목록(findAll)에서는 쓰지 않는데 캠페인마다
   * 대상자 행을 전부 읽어야 해서 목록 조회가 무거워진다.
   */
  @Get(":id/audience/selection")
  selectionAudience(
    @Param("id") id: string,
  ): Promise<CampaignAudienceSelectionResponse> {
    return this.audience.selection(id);
  }

  /** 끌어올리기 — 인플루언서 목록에서 같은 상태 그룹 내 최상단으로 올린다. */
  @Post(":id/bump")
  bump(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.bump(id, req.user);
  }

  @Post(":id/close")
  close(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.close(id, req.user);
  }

  /** 비공개 전환 — 모집이 종결된 캠페인만 가능하다. */
  @Post(":id/hide")
  hide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.hide(id, req.user);
  }

  @Post(":id/unhide")
  unhide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.unhide(id, req.user);
  }

  /** 임시저장은 물리 삭제, 발행된 캠페인은 종료와 함께 논리 삭제. */
  @Delete(":id")
  remove(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    return this.campaigns.remove(id, req.user);
  }
}
