import { canManagePermissions } from "../permissions/permissions-access.guard";
import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { ReportsService } from "./reports.service";
@Controller()
@UseGuards(BearerAuthGuard)
export class OverviewController {
 constructor(private readonly reports:ReportsService) {}
 @Get("me") me(@Req() r:AuthenticatedRequest){return {user:{...r.user,canManagePermissions:canManagePermissions(r.user)}};}
 @Get("dashboard/overview") overview(@Req() r:AuthenticatedRequest,@Query("date") date?:string,@Query("department_id") dept?:string,@Query("search") search?:string){return this.reports.overview(r.user,date,dept,search);}
 @Get("kpi-definitions") definitions(@Req() r:AuthenticatedRequest){return this.reports.definitions(r.user);}
}
