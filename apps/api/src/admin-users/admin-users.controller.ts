import { Controller, Get, UseGuards } from "@nestjs/common";
import type { ListAdminUsersResponse } from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminUsersService } from "./admin-users.service";

@UseGuards(JwtAuthGuard)
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(): Promise<ListAdminUsersResponse> {
    const users = await this.adminUsers.findAllPublic();
    return { users };
  }
}
