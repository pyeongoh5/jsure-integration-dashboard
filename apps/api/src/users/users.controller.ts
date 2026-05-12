import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ListUsersResponse } from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<ListUsersResponse> {
    const users = await this.users.findAllPublic();
    return { users };
  }
}
