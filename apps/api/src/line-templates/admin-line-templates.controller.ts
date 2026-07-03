import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CampaignCategorySchema,
  LineTriggerKeySchema,
  LineTriggerSubTypeSchema,
  PreviewLineMessageTemplateRequestSchema,
  TestSendLineMessageTemplateRequestSchema,
  ToggleLineMessageTemplateEnabledRequestSchema,
  UpdateLineMessageTemplateRequestSchema,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineMessageTemplateListResponse,
  type LineMessageTemplateResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
  type PreviewLineMessageTemplateRequest,
  type PreviewLineMessageTemplateResponse,
  type TestSendLineMessageTemplateRequest,
  type TestSendLineMessageTemplateResponse,
  type ToggleLineMessageTemplateEnabledRequest,
  type UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminLineTemplatesService } from "./admin-line-templates.service";

function parseParams(
  category: string,
  subType: string,
  triggerKey: string,
): { category: CampaignCategory; subType: LineTriggerSubType | null; triggerKey: LineTriggerKey } {
  const parsedCategory = CampaignCategorySchema.parse(category);
  const parsedSubType = subType === "none" ? null : LineTriggerSubTypeSchema.parse(subType);
  const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
  return { category: parsedCategory, subType: parsedSubType, triggerKey: parsedTriggerKey };
}

@UseGuards(JwtAuthGuard)
@Controller("admin/line-templates")
export class AdminLineTemplatesController {
  constructor(private readonly svc: AdminLineTemplatesService) {}

  @Get()
  async list(
    @Query("category") category: string,
    @Query("subType") subType?: string,
  ): Promise<LineMessageTemplateListResponse> {
    const parsedCategory = CampaignCategorySchema.parse(category);
    const parsedSubType =
      !subType || subType === "none" ? null : LineTriggerSubTypeSchema.parse(subType);
    return this.svc.list(parsedCategory, parsedSubType);
  }

  @Get(":category/:subType/:triggerKey")
  async detail(
    @Param("category") category: string,
    @Param("subType") subType: string,
    @Param("triggerKey") triggerKey: string,
  ): Promise<LineMessageTemplateDetailResponse> {
    const p = parseParams(category, subType, triggerKey);
    return this.svc.detail(p.category, p.subType, p.triggerKey);
  }

  @Put(":category/:subType/:triggerKey")
  async update(
    @Param("category") category: string,
    @Param("subType") subType: string,
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(UpdateLineMessageTemplateRequestSchema))
    input: UpdateLineMessageTemplateRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<LineMessageTemplateResponse> {
    const p = parseParams(category, subType, triggerKey);
    return this.svc.update(p.category, p.subType, p.triggerKey, req.user.id, input);
  }

  @Patch(":category/:subType/:triggerKey/enabled")
  async setEnabled(
    @Param("category") category: string,
    @Param("subType") subType: string,
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(ToggleLineMessageTemplateEnabledRequestSchema))
    input: ToggleLineMessageTemplateEnabledRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<LineMessageTemplateResponse> {
    const p = parseParams(category, subType, triggerKey);
    return this.svc.setEnabled(p.category, p.subType, p.triggerKey, req.user.id, input.enabled);
  }

  @Post(":category/:subType/:triggerKey/preview")
  async preview(
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(PreviewLineMessageTemplateRequestSchema))
    input: PreviewLineMessageTemplateRequest,
  ): Promise<PreviewLineMessageTemplateResponse> {
    const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
    return this.svc.preview(parsedTriggerKey, input.body);
  }

  @Post(":category/:subType/:triggerKey/test-send")
  async testSend(
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(TestSendLineMessageTemplateRequestSchema))
    input: TestSendLineMessageTemplateRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<TestSendLineMessageTemplateResponse> {
    const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
    return this.svc.testSend(parsedTriggerKey, input.body, req.user.id);
  }
}
