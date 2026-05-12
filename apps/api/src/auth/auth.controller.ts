import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  HttpCode,
  UsePipes,
} from "@nestjs/common";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@jsure/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

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
  login(@Body() dto: LoginRequest) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Request() req: { user: unknown }) {
    return req.user;
  }
}
