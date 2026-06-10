import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Put,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  InfluencerBankAccountSchema,
  InfluencerSnsAccountInputSchema,
  SnsTypeSchema,
  UpdateInfluencerAddressRequestSchema,
  UpdateInfluencerProfileRequestSchema,
  type InfluencerBankAccount,
  type InfluencerSnsAccountInput,
  type UpdateInfluencerAddressRequest,
  type UpdateInfluencerProfileRequest,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import type { AuthenticatedInfluencer } from "../influencer-auth/strategies/influencer-jwt.strategy";
import { InfluencerMeService } from "./influencer-me.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("influencer-me")
export class InfluencerMeController {
  constructor(private readonly svc: InfluencerMeService) {}

  @Patch("profile")
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(UpdateInfluencerProfileRequestSchema))
  async updateProfile(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body() dto: UpdateInfluencerProfileRequest,
  ) {
    await this.svc.updateProfile(req.user.id, dto);
  }

  @Patch("address")
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(UpdateInfluencerAddressRequestSchema))
  async updateAddress(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body() dto: UpdateInfluencerAddressRequest,
  ) {
    await this.svc.updateAddress(req.user.id, dto);
  }

  @Put("sns")
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(InfluencerSnsAccountInputSchema))
  async upsertSns(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body() dto: InfluencerSnsAccountInput,
  ) {
    await this.svc.upsertSnsAccount(req.user.id, dto);
  }

  @Delete("sns/:snsType")
  @HttpCode(204)
  async deleteSns(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("snsType") raw: string,
  ) {
    const snsType = SnsTypeSchema.parse(raw);
    await this.svc.deleteSnsAccount(req.user.id, snsType);
  }

  @Put("bank")
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(InfluencerBankAccountSchema))
  async upsertBank(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body() dto: InfluencerBankAccount,
  ) {
    await this.svc.upsertBankAccount(req.user.id, dto);
  }
}
