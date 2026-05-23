import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface InfluencerJwtPayload {
  sub: string;
  email: string;
  kind: "influencer";
  sid: string;
}

export interface AuthenticatedInfluencer {
  id: string;
  email: string;
  sid: string;
}

@Injectable()
export class InfluencerJwtStrategy extends PassportStrategy(
  Strategy,
  "influencer-jwt",
) {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is not configured");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: InfluencerJwtPayload): Promise<AuthenticatedInfluencer> {
    if (payload.kind !== "influencer") {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      email: payload.email,
      sid: payload.sid,
    };
  }
}
