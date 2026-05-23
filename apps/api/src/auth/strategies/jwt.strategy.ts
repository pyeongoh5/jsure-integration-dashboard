import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { PublicAdminUser } from "@jsure/shared";
import type { JwtPayload } from "../auth.service";
import { AdminUsersService } from "../../admin-users/admin-users.service";

export type AuthenticatedUser = PublicAdminUser & { sid: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: AdminUsersService,
  ) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is not configured");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findPublicById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { ...user, sid: payload.sid };
  }
}
