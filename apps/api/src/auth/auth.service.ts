import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (user.status === "PENDING") {
      throw new ForbiddenException({
        code: "ACCOUNT_PENDING",
        message: "가입 승인 대기 중인 계정입니다.",
      });
    }
    if (user.status === "SUSPENDED") {
      throw new ForbiddenException({
        code: "ACCOUNT_SUSPENDED",
        message: "정지된 계정입니다. 관리자에게 문의하세요.",
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const { passwordHash: _ph, ...safe } = user;
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: safe,
    };
  }

  async register(input: { email: string; password: string; name?: string }) {
    const created = await this.users.create(input);
    return {
      status: "PENDING" as const,
      email: created.email,
      message:
        "가입이 요청되었습니다. 관리자의 승인이 완료되면 로그인할 수 있습니다.",
    };
  }
}
