import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { ReportsService } from "../reports/reports.service";
@Controller("leaderboard")
@UseGuards(BearerAuthGuard)
export class LeaderboardController {
 constructor(private readonly reports:ReportsService) {}
 @Get() get(@Req() request:AuthenticatedRequest,@Query("month") month?:string,@Query("department_id") departmentId?:string) {
  return this.reports.leaderboard(month,departmentId);
 }
}
