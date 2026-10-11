import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PermissionsAccessGuard } from "../permissions/permissions-access.guard";
import { UpdateUserRoleDto } from "./update-user-role.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(BearerAuthGuard, PermissionsAccessGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Patch(":id/role")
  updateRole(
    @Param("id") id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.users.updateRole(id, body.role, request.user.id);
  }
}
