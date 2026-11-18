import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  BuilderSurveyListQuerySchema,
  CreateBuilderSurveyRequestSchema,
  UpdateBuilderSurveyRequestSchema,
  type BuilderSurveyPageResponse,
  type BuilderSurveyResponse,
  type CreateBuilderSurveyRequest,
  type UpdateBuilderSurveyRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { BuilderSurveysService } from "./builder-surveys.service";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parseLimit(rawLimit?: string): number {
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

@UseGuards(JwtAuthGuard)
@Controller("admin/builder/surveys")
export class BuilderSurveysController {
  constructor(private readonly surveys: BuilderSurveysService) {}

  @Get()
  list(
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
  ): Promise<BuilderSurveyPageResponse> {
    const parsedQuery = BuilderSurveyListQuerySchema.safeParse({ q });
    const query = parsedQuery.success ? parsedQuery.data.q : undefined;
    return this.surveys.listPage(cursor ?? null, parseLimit(limit), query);
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<BuilderSurveyResponse> {
    return this.surveys.get(id);
  }

  @Post()
  create(
    @Req() request: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateBuilderSurveyRequestSchema))
    body: CreateBuilderSurveyRequest,
  ): Promise<BuilderSurveyResponse> {
    return this.surveys.create(request.user.id, body);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Req() request: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(UpdateBuilderSurveyRequestSchema))
    body: UpdateBuilderSurveyRequest,
  ): Promise<BuilderSurveyResponse> {
    return this.surveys.update(id, request.user.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.surveys.softDelete(id);
  }
}
