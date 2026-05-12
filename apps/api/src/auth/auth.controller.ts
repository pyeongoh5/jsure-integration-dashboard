import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import {
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  type ListSessionsResponse,
  type LoginRequest,
  type LogoutRequest,
  type RefreshRequest,
  type RegisterRequest,
} from "@jsure/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { SessionContext } from "./sessions.service";
import type { AuthenticatedUser } from "./strategies/jwt.strategy";

function ctxFrom(req: ExpressRequest): SessionContext {
  return {
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(202)
  @Post("register")
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  register(@Body() dto: RegisterRequest) {
    return this.auth.register(dto);
  }

  @HttpCode(200)
  @Post("login")
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  login(@Body() dto: LoginRequest, @Request() req: ExpressRequest) {
    return this.auth.login(dto.email, dto.password, ctxFrom(req));
  }

  @HttpCode(200)
  @Post("refresh")
  @UsePipes(new ZodValidationPipe(RefreshRequestSchema))
  refresh(@Body() dto: RefreshRequest, @Request() req: ExpressRequest) {
    return this.auth.refresh(dto.refreshToken, ctxFrom(req));
  }

  @HttpCode(204)
  @Post("logout")
  @UsePipes(new ZodValidationPipe(LogoutRequestSchema))
  async logout(@Body() dto: LogoutRequest) {
    await this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Request() req: { user: AuthenticatedUser }) {
    const { sid: _sid, ...publicUser } = req.user;
    return publicUser;
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  async listSessions(
    @Request() req: { user: AuthenticatedUser },
  ): Promise<ListSessionsResponse> {
    const sessions = await this.auth.listSessions(req.user.id, req.user.sid);
    return { sessions };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @Delete("sessions/:id")
  async revokeSession(
    @Request() req: { user: AuthenticatedUser },
    @Param("id") sessionId: string,
  ) {
    const ok = await this.auth.revokeSession(req.user.id, sessionId);
    if (!ok) throw new NotFoundException("Session not found");
  }
}
