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
  PreviewLineMessageTemplateRequestSchema,
  TestSendLineMessageTemplateRequestSchema,
  ToggleLineMessageTemplateEnabledRequestSchema,
  UpdateLineMessageTemplateRequestSchema,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineMessageTemplateListResponse,
  type LineMessageTemplateResponse,
  type LineTriggerKey,
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
  triggerKey: string,
): { category: CampaignCategory; triggerKey: LineTriggerKey } {
  return {
    category: CampaignCategorySchema.parse(category),
    triggerKey: LineTriggerKeySchema.parse(triggerKey),
  };
}

@UseGuards(JwtAuthGuard)
@Controller("admin/line-templates")
export class AdminLineTemplatesController {
  constructor(private readonly svc: AdminLineTemplatesService) {}

  @Get()
  async list(@Query("category") category: string): Promise<LineMessageTemplateListResponse> {
    const parsedCategory = CampaignCategorySchema.parse(category);
    return this.svc.list(parsedCategory);
  }

  @Get(":category/:triggerKey")
  async detail(
    @Param("category") category: string,
    @Param("triggerKey") triggerKey: string,
  ): Promise<LineMessageTemplateDetailResponse> {
    const parsed = parseParams(category, triggerKey);
    return this.svc.detail(parsed.category, parsed.triggerKey);
  }

  @Put(":category/:triggerKey")
  async update(
    @Param("category") category: string,
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(UpdateLineMessageTemplateRequestSchema))
    input: UpdateLineMessageTemplateRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<LineMessageTemplateResponse> {
    const parsed = parseParams(category, triggerKey);
    return this.svc.update(parsed.category, parsed.triggerKey, req.user.id, input);
  }

  @Patch(":category/:triggerKey/enabled")
  async setEnabled(
    @Param("category") category: string,
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(ToggleLineMessageTemplateEnabledRequestSchema))
    input: ToggleLineMessageTemplateEnabledRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<LineMessageTemplateResponse> {
    const parsed = parseParams(category, triggerKey);
    return this.svc.setEnabled(parsed.category, parsed.triggerKey, req.user.id, input.enabled);
  }

  @Post(":category/:triggerKey/preview")
  async preview(
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(PreviewLineMessageTemplateRequestSchema))
    input: PreviewLineMessageTemplateRequest,
  ): Promise<PreviewLineMessageTemplateResponse> {
    const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
    return this.svc.preview(parsedTriggerKey, input.body);
  }

  @Post(":category/:triggerKey/test-send")
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
