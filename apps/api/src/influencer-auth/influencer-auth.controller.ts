import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Redirect,
  Request,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import {
  InfluencerLoginRequestSchema,
  InfluencerLogoutRequestSchema,
  InfluencerRefreshRequestSchema,
  InfluencerSignupRequestSchema,
  LineCompleteSignupRequestSchema,
  type InfluencerLoginRequest,
  type InfluencerLogoutRequest,
  type InfluencerMeResponse,
  type InfluencerRefreshRequest,
  type InfluencerSignupRequest,
  type LineCompleteSignupRequest,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  toAddressResponse,
  toBankAccountResponse,
} from "../common/account-columns";
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
  private readonly logger = new Logger(InfluencerAuthController.name);

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
      this.logger.warn(`LINE 콜백 실패: LINE 측 에러 (${error}) ip=${req.ip}`);
      throw new BadRequestException(`LINE auth error: ${error}`);
    }
    if (!code || !state) {
      this.logger.warn(`LINE 콜백 실패: code/state 누락 ip=${req.ip}`);
      throw new BadRequestException("Missing code or state");
    }
    let result: Awaited<ReturnType<InfluencerLineAuthService["handleCallback"]>>;
    try {
      result = await this.line.handleCallback({
        code,
        state,
        ctx: ctxFrom(req),
      });
    } catch (err) {
      this.logger.warn(
        `LINE 콜백 실패: ${err instanceof Error ? err.message : String(err)} ip=${req.ip}`,
      );
      throw err;
    }
    if (result.kind === "login") {
      this.logger.log(
        `LINE 콜백 성공: kind=login influencer=${result.auth.influencer.id} email=${result.auth.influencer.email} ip=${req.ip}`,
      );
    } else {
      this.logger.log(
        `LINE 콜백 성공: kind=signup displayName=${result.displayName ?? "(없음)"} ip=${req.ip}`,
      );
    }
    if (result.kind === "login") {
      const url = new URL(result.redirectTo);
      url.searchParams.set("line_access_token", result.auth.accessToken);
      url.searchParams.set("line_refresh_token", result.auth.refreshToken);
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

  /** 액세스 토큰 만료 시 리프레시 토큰을 회전시켜 재발급. */
  @HttpCode(200)
  @Post("refresh")
  @UsePipes(new ZodValidationPipe(InfluencerRefreshRequestSchema))
  refresh(@Body() dto: InfluencerRefreshRequest, @Request() req: ExpressRequest) {
    return this.auth.refresh(dto.refreshToken, ctxFrom(req));
  }

  // 액세스 토큰이 만료돼도 세션을 폐기할 수 있도록 가드 없이 리프레시 토큰으로 처리.
  @HttpCode(204)
  @Post("logout")
  @UsePipes(new ZodValidationPipe(InfluencerLogoutRequestSchema))
  async logout(@Body() dto: InfluencerLogoutRequest) {
    if (dto.refreshToken) {
      await this.auth.logout(dto.refreshToken);
    }
  }

  @UseGuards(InfluencerJwtAuthGuard)
  @Get("me")
  async me(
    @Request() req: { user: AuthenticatedInfluencer },
  ): Promise<InfluencerMeResponse> {
    // 토큰은 유효하지만 계정이 삭제된 경우(DB 초기화 등) — 401 로 재로그인 유도.
    const inf = await this.influencers.findFull(req.user.id);
    if (!inf) throw new UnauthorizedException("Influencer not found");
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
      // DB 는 string 으로 저장하고 회원가입에서 국가별 enum 검증을 거치므로 안전.
      address: hasAddress ? toAddressResponse(inf) : null,
      snsAccounts: inf.snsAccounts.map((s) => ({
        snsType: s.snsType as InfluencerMeResponse["snsAccounts"][number]["snsType"],
        handle: s.handle,
        followerCount: s.followerCount,
      })),
      bankAccount: inf.bankAccount
        ? toBankAccountResponse(
            inf.bankAccount,
            maskAccountNumber(inf.bankAccount.accountNumber),
          )
        : null,
    };
  }
}
