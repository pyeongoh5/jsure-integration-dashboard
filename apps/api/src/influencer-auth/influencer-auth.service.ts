import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  InfluencerSessionsService,
  type SessionContext,
} from "./influencer-sessions.service";
import type {
  InfluencerAuthResponse,
  InfluencerSignupRequest,
  PublicInfluencer,
} from "@jsure/shared";

interface SignableInfluencer {
  id: string;
  email: string;
  name: string;
}

function toPublic(i: SignableInfluencer): PublicInfluencer {
  return {
    id: i.id,
    email: i.email,
    name: i.name,
  };
}

@Injectable()
export class InfluencerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: InfluencerSessionsService,
  ) {}

  private async signAccessToken(
    inf: SignableInfluencer,
    sid: string,
  ): Promise<string> {
    return this.jwt.signAsync({
      sub: inf.id,
      email: inf.email,
      kind: "influencer",
      sid,
    });
  }

  async signup(
    input: InfluencerSignupRequest,
    ctx: SessionContext,
  ): Promise<InfluencerAuthResponse> {
    const passwordHash = await bcrypt.hash(input.password, 10);

    let influencer: SignableInfluencer;
    try {
      influencer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.influencer.create({
          data: {
            email: input.email,
            passwordHash,
            name: input.name,
            nameKana: input.nameKana,
            phone: input.phone,
            birthDate: new Date(`${input.birthDate}T00:00:00Z`),
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

        return created;
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

    const { sessionId } = await this.sessions.create(influencer.id, ctx);
    const accessToken = await this.signAccessToken(influencer, sessionId);
    return { accessToken, influencer: toPublic(influencer) };
  }

  async login(
    email: string,
    password: string,
    ctx: SessionContext,
  ): Promise<InfluencerAuthResponse> {
    const inf = await this.prisma.influencer.findUnique({ where: { email } });
    if (!inf || !inf.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(password, inf.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    if (inf.status !== "ACTIVE") {
      throw new UnauthorizedException("Account inactive");
    }
    const { sessionId } = await this.sessions.create(inf.id, ctx);
    const accessToken = await this.signAccessToken(inf, sessionId);
    return { accessToken, influencer: toPublic(inf) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revokeByToken(refreshToken);
  }
}
