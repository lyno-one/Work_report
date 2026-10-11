import { canManagePermissions } from "../permissions/permissions-access.guard";
import { CrmLoginDto } from "../crm/crm-login.dto";
import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "./bearer-auth.guard";
import type { AuthenticatedRequest } from "./auth.types";
import { LoginDto } from "./login.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("config") config(){return this.auth.config();}
  @Post("crm-login") loginCrm(@Body() body:CrmLoginDto){return this.auth.loginCrm(body.email,body.password);}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(BearerAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: {...request.user,canManagePermissions:canManagePermissions(request.user)} };
  }
}
