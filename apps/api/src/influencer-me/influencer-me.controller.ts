import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  CreateWithdrawalRequestSchema,
  InfluencerBankAccountSchema,
  InfluencerSnsAccountInputSchema,
  SnsAccountSubTypeSchema,
  UpdateInfluencerAddressRequestSchema,
  UpdateInfluencerProfileRequestSchema,
  type CreateWithdrawalRequest,
  type InfluencerBankAccount,
  type InfluencerSnsAccountInput,
  type InfluencerWithdrawal,
  type UpdateInfluencerAddressRequest,
  type UpdateInfluencerProfileRequest,
  type WithdrawalEligibilityResponse,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import type { AuthenticatedInfluencer } from "../influencer-auth/strategies/influencer-jwt.strategy";
import { InfluencerMeService } from "./influencer-me.service";
import { InfluencerMeWithdrawalService } from "./influencer-me-withdrawal.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("influencer-me")
export class InfluencerMeController {
  constructor(
    private readonly svc: InfluencerMeService,
    private readonly withdrawals: InfluencerMeWithdrawalService,
  ) {}

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
    const snsType = SnsAccountSubTypeSchema.parse(raw);
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

  /** 탈퇴 안내 화면이 신청 가능 여부와 그 근거를 한 번에 받는다. */
  @Get("withdrawal")
  withdrawalEligibility(
    @Request() req: { user: AuthenticatedInfluencer },
  ): Promise<WithdrawalEligibilityResponse> {
    return this.withdrawals.getEligibility(req.user.id);
  }

  @Post("withdrawal")
  @HttpCode(201)
  requestWithdrawal(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body(new ZodValidationPipe(CreateWithdrawalRequestSchema))
    dto: CreateWithdrawalRequest,
  ): Promise<InfluencerWithdrawal> {
    return this.withdrawals.request(req.user.id, dto);
  }
}
