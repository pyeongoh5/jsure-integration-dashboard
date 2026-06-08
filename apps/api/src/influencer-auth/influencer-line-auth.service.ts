import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  InfluencerSessionsService,
  type SessionContext,
} from "./influencer-sessions.service";
import type {
  InfluencerAuthResponse,
  LineCompleteSignupRequest,
  PublicInfluencer,
} from "@jsure/shared";

const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

const SIGNUP_TOKEN_TTL_SECONDS = 30 * 60;

interface LineTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
}

interface LineIdTokenClaims {
  iss: string;
  sub: string; // line userId
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  name?: string;
  picture?: string;
}

interface LineAuthorizeResult {
  url: string;
}

interface LineStatePayload {
  nonce: string;
  purpose: "line-oauth";
}

function toPublic(i: {
  id: string;
  email: string | null;
  name: string;
}): PublicInfluencer {
  return {
    id: i.id,
    email: i.email ?? "",
    name: i.name,
  };
}

@Injectable()
export class InfluencerLineAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: InfluencerSessionsService,
    private readonly config: ConfigService,
  ) {}

  private getRequiredConfig(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) {
      throw new InternalServerErrorException(
        `Missing required env: ${key}`,
      );
    }
    return v;
  }

  private channelId(): string {
    return this.getRequiredConfig("LINE_LOGIN_CHANNEL_ID");
  }
  private channelSecret(): string {
    return this.getRequiredConfig("LINE_LOGIN_CHANNEL_SECRET");
  }
  private callbackUrl(): string {
    return this.getRequiredConfig("LINE_LOGIN_CALLBACK_URL");
  }
  private postLoginRedirect(): string {
    return this.getRequiredConfig("LINE_LOGIN_POST_LOGIN_REDIRECT");
  }
  private signupRedirect(): string {
    return this.getRequiredConfig("LINE_LOGIN_SIGNUP_REDIRECT");
  }

  async buildAuthorizeUrl(): Promise<LineAuthorizeResult> {
    const nonce = randomToken(16);
    const state = await this.jwt.signAsync(
      { nonce, purpose: "line-oauth" } satisfies LineStatePayload,
      { expiresIn: "10m" },
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.channelId(),
      redirect_uri: this.callbackUrl(),
      state,
      scope: "profile openid",
      nonce,
    });
    return { url: `${LINE_AUTHORIZE_URL}?${params.toString()}` };
  }

  async handleCallback(args: {
    code: string;
    state: string;
    ctx: SessionContext;
  }): Promise<{
    kind: "login";
    auth: InfluencerAuthResponse;
    redirectTo: string;
  } | {
    kind: "signup";
    signupToken: string;
    displayName: string | null;
    redirectTo: string;
  }> {
    let statePayload: LineStatePayload;
    try {
      statePayload = await this.jwt.verifyAsync<LineStatePayload>(args.state);
    } catch {
      throw new UnauthorizedException("Invalid or expired state");
    }
    if (statePayload.purpose !== "line-oauth") {
      throw new UnauthorizedException("Invalid state purpose");
    }
    const token = await this.exchangeCode(args.code);
    const claims = await this.verifyIdToken(token.id_token, statePayload.nonce);

    const lineUserId = claims.sub;
    const displayName = claims.name ?? null;

    const existing = await this.prisma.influencer.findUnique({
      where: { lineUserId },
    });

    if (existing) {
      if (existing.status !== "ACTIVE") {
        throw new UnauthorizedException("Account inactive");
      }
      const { sessionId } = await this.sessions.create(existing.id, args.ctx);
      const accessToken = await this.jwt.signAsync({
        sub: existing.id,
        email: existing.email,
        kind: "influencer",
        sid: sessionId,
      });
      return {
        kind: "login",
        auth: { accessToken, influencer: toPublic(existing) },
        redirectTo: this.postLoginRedirect(),
      };
    }

    const signupToken = await this.jwt.signAsync(
      { lineUserId, displayName, purpose: "line-signup" },
      { expiresIn: SIGNUP_TOKEN_TTL_SECONDS },
    );
    return {
      kind: "signup",
      signupToken,
      displayName,
      redirectTo: this.signupRedirect(),
    };
  }

  async completeSignup(
    input: LineCompleteSignupRequest,
    ctx: SessionContext,
  ): Promise<InfluencerAuthResponse> {
    let payload: { lineUserId: string; displayName: string | null; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(input.signupToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired signup token");
    }
    if (payload.purpose !== "line-signup") {
      throw new UnauthorizedException("Invalid signup token");
    }

    const lineUserId = payload.lineUserId;
    const existsByLine = await this.prisma.influencer.findUnique({
      where: { lineUserId },
    });
    if (existsByLine) {
      throw new ConflictException({
        code: "LINE_ALREADY_LINKED",
        message: "このLINEアカウントは既に登録されています",
      });
    }

    const passwordHash = input.password
      ? await import("bcrypt").then((m) => m.hash(input.password!, 10))
      : null;

    let influencerId: string;
    try {
      influencerId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.influencer.create({
          data: {
            email: input.email,
            passwordHash,
            lineUserId,
            lineLinkedAt: new Date(),
            name: input.name,
            nameKana: input.nameKana,
            phone: input.phone,
            postalCode: input.address.postalCode,
            prefecture: input.address.prefecture,
            city: input.address.city,
            addressLine1: input.address.addressLine1,
            addressLine2: input.address.addressLine2 ?? "",
          },
        });
        for (const sns of input.snsAccounts) {
          await tx.influencerSnsAccount.create({
            data: {
              influencerId: created.id,
              snsType: sns.snsType,
              handle: sns.handle,
              followerCount: sns.followerCount,
            },
          });
        }
        await tx.influencerBankAccount.create({
          data: {
            influencerId: created.id,
            bankCode: input.bankAccount.bankCode,
            bankName: input.bankAccount.bankName,
            branchName: input.bankAccount.branchName,
            branchCode: input.bankAccount.branchCode,
            accountType: input.bankAccount.accountType,
            accountNumber: input.bankAccount.accountNumber,
            accountHolderKana: input.bankAccount.accountHolderKana,
          },
        });
        await tx.influencerConsent.create({
          data: {
            influencerId: created.id,
            termsVersion: input.termsVersion,
            agreedItems: input.agreedItems,
            ip: ctx.ip ?? null,
            userAgent: ctx.userAgent ?? null,
          },
        });
        return created.id;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "メールアドレスは既に使用されています",
        });
      }
      throw err;
    }

    const inf = await this.prisma.influencer.findUniqueOrThrow({
      where: { id: influencerId },
    });
    const { sessionId } = await this.sessions.create(inf.id, ctx);
    const accessToken = await this.jwt.signAsync({
      sub: inf.id,
      email: inf.email,
      kind: "influencer",
      sid: sessionId,
    });
    return { accessToken, influencer: toPublic(inf) };
  }

  private async exchangeCode(code: string): Promise<LineTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.callbackUrl(),
      client_id: this.channelId(),
      client_secret: this.channelSecret(),
    });
    const res = await fetch(LINE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`LINE token exchange failed: ${text}`);
    }
    return (await res.json()) as LineTokenResponse;
  }

  private async verifyIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<LineIdTokenClaims> {
    const body = new URLSearchParams({
      id_token: idToken,
      client_id: this.channelId(),
      nonce: expectedNonce,
    });
    const res = await fetch(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new UnauthorizedException(`Invalid LINE id_token: ${text}`);
    }
    const claims = (await res.json()) as LineIdTokenClaims;
    if (claims.aud !== this.channelId()) {
      throw new UnauthorizedException("id_token aud mismatch");
    }
    if (claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException("id_token expired");
    }
    return claims;
  }
}

function randomToken(bytes: number): string {
  return require("crypto").randomBytes(bytes).toString("base64url");
}
