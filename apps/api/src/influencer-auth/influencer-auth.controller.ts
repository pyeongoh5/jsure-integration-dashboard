import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Redirect,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import {
  InfluencerLoginRequestSchema,
  InfluencerSignupRequestSchema,
  LineCompleteSignupRequestSchema,
  type InfluencerLoginRequest,
  type InfluencerMeResponse,
  type InfluencerSignupRequest,
  type JpPrefecture,
  type LineCompleteSignupRequest,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InfluencerAuthService } from "./influencer-auth.service";
import { InfluencerLineAuthService } from "./influencer-line-auth.service";
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
    private readonly line: InfluencerLineAuthService,
    private readonly influencers: InfluencersService,
  ) {}

  @Get("line/authorize")
  @Redirect()
  async lineAuthorize() {
    const { url } = await this.line.buildAuthorizeUrl();
    return { url, statusCode: 302 };
  }

  @Get("line/callback")
  @Redirect()
  async lineCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Request() req: ExpressRequest,
  ) {
    if (error) {
      throw new BadRequestException(`LINE auth error: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException("Missing code or state");
    }
    const result = await this.line.handleCallback({
      code,
      state,
      ctx: ctxFrom(req),
    });
    if (result.kind === "login") {
      const url = new URL(result.redirectTo);
      url.searchParams.set("line_access_token", result.auth.accessToken);
      return { url: url.toString(), statusCode: 302 };
    }
    const url = new URL(result.redirectTo);
    url.searchParams.set("signup_token", result.signupToken);
    if (result.displayName) {
      url.searchParams.set("display_name", result.displayName);
    }
    return { url: url.toString(), statusCode: 302 };
  }

  @HttpCode(201)
  @Post("line/complete-signup")
  @UsePipes(new ZodValidationPipe(LineCompleteSignupRequestSchema))
  lineCompleteSignup(
    @Body() dto: LineCompleteSignupRequest,
    @Request() req: ExpressRequest,
  ) {
    return this.line.completeSignup(dto, ctxFrom(req));
  }

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
    const hasAddress =
      Boolean(inf.postalCode) || Boolean(inf.prefecture) || Boolean(inf.city) ||
      Boolean(inf.addressLine1);
    return {
      id: inf.id,
      email: inf.email,
      name: inf.name,
      nameKana: inf.nameKana,
      phone: inf.phone,
      birthDate: inf.birthDate
        ? inf.birthDate.toISOString().slice(0, 10)
        : null,
      address: hasAddress
        ? {
            postalCode: inf.postalCode,
            // DB 는 string 으로 저장, 회원가입에서 enum 검증을 거치므로 안전
            prefecture: inf.prefecture as JpPrefecture,
            city: inf.city,
            addressLine1: inf.addressLine1,
            addressLine2: inf.addressLine2 ?? "",
          }
        : null,
      snsAccounts: inf.snsAccounts.map((s) => ({
        snsType: s.snsType,
        handle: s.handle,
        followerCount: s.followerCount,
      })),
      bankAccount: inf.bankAccount
        ? {
            bankCode: inf.bankAccount.bankCode,
            bankName: inf.bankAccount.bankName,
            branchName: inf.bankAccount.branchName,
            branchCode: inf.bankAccount.branchCode,
            accountHolderKana: inf.bankAccount.accountHolderKana,
            accountNumberMasked: maskAccountNumber(
              inf.bankAccount.accountNumber,
            ),
          }
        : null,
    };
  }
}
