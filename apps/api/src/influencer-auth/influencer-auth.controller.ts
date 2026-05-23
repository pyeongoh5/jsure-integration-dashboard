import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import {
  InfluencerLoginRequestSchema,
  InfluencerSignupRequestSchema,
  type InfluencerLoginRequest,
  type InfluencerMeResponse,
  type InfluencerSignupRequest,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InfluencerAuthService } from "./influencer-auth.service";
import { InfluencerJwtAuthGuard } from "./guards/influencer-jwt-auth.guard";
import { InfluencersService } from "../influencers/influencers.service";
import type { AuthenticatedInfluencer } from "./strategies/influencer-jwt.strategy";
import type { SessionContext } from "./influencer-sessions.service";

function ctxFrom(req: ExpressRequest): SessionContext {
  return {
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
  };
}

function maskAccountNumber(value: string): string {
  if (value.length <= 4) return value;
  return "*".repeat(value.length - 4) + value.slice(-4);
}

@Controller("influencer-auth")
export class InfluencerAuthController {
  constructor(
    private readonly auth: InfluencerAuthService,
    private readonly influencers: InfluencersService,
  ) {}

  @HttpCode(201)
  @Post("signup")
  @UsePipes(new ZodValidationPipe(InfluencerSignupRequestSchema))
  signup(@Body() dto: InfluencerSignupRequest, @Request() req: ExpressRequest) {
    return this.auth.signup(dto, ctxFrom(req));
  }

  @HttpCode(200)
  @Post("login")
  @UsePipes(new ZodValidationPipe(InfluencerLoginRequestSchema))
  login(@Body() dto: InfluencerLoginRequest, @Request() req: ExpressRequest) {
    return this.auth.login(dto.email, dto.password, ctxFrom(req));
  }

  @UseGuards(InfluencerJwtAuthGuard)
  @HttpCode(204)
  @Post("logout")
  async logout(@Request() _req: { user: AuthenticatedInfluencer }) {
    // Influencers don't use refresh tokens in MVP — access token expiry alone.
  }

  @UseGuards(InfluencerJwtAuthGuard)
  @Get("me")
  async me(
    @Request() req: { user: AuthenticatedInfluencer },
  ): Promise<InfluencerMeResponse> {
    const inf = await this.influencers.findFull(req.user.id);
    if (!inf) throw new NotFoundException("Influencer not found");
    return {
      id: inf.id,
      email: inf.email,
      name: inf.name,
      nameKana: inf.nameKana,
      phone: inf.phone,
      entityType: inf.entityType,
      snsAccounts: inf.snsAccounts.map((s) => ({
        snsType: s.snsType,
        handle: s.handle,
        followerCount: s.followerCount,
      })),
      bankAccount: inf.bankAccount
        ? {
            ownerType: inf.bankAccount.ownerType,
            bankCode: inf.bankAccount.bankCode,
            bankName: inf.bankAccount.bankName,
            branchName: inf.bankAccount.branchName,
            accountType: inf.bankAccount.accountType,
            accountHolderKana: inf.bankAccount.accountHolderKana,
            accountNumberMasked: maskAccountNumber(
              inf.bankAccount.accountNumber,
            ),
          }
        : null,
    };
  }
}
