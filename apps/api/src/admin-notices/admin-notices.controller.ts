import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CreateNoticeRequestSchema,
  UpdateNoticeRequestSchema,
  type AdminNoticeListResponse,
  type CreateNoticeRequest,
  type NoticeResponse,
  type UpdateNoticeRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminNoticesService } from "./admin-notices.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/notices")
export class AdminNoticesController {
  constructor(private readonly svc: AdminNoticesService) {}

  @Get()
  list(): Promise<AdminNoticeListResponse> {
    return this.svc.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<NoticeResponse> {
    return this.svc.get(id);
  }

  @Post()
  create(
    @Req() request: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateNoticeRequestSchema))
    body: CreateNoticeRequest,
  ): Promise<NoticeResponse> {
    return this.svc.create(request.user.id, body);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateNoticeRequestSchema))
    body: UpdateNoticeRequest,
  ): Promise<NoticeResponse> {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.svc.remove(id);
  }
}
