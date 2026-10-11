import { CrmService } from "../crm/crm.service";
import type { Response } from "express";
import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { CreateReportDto, ImportReportsDto, ReopenReportDto, VersionDto } from "./create-report.dto";
import { ReviewReportDto } from "./review-report.dto";
import { ReportsService } from "./reports.service";
@Controller(["reports","daily-reports"])
@UseGuards(BearerAuthGuard, RolesGuard)
export class ReportsController {
 constructor(private readonly reports: ReportsService, private readonly crm:CrmService) {}
 @Get() list(@Req() r:AuthenticatedRequest,@Query("date") date?:string,@Query("department_id") dept?:string,@Query("search") search?:string) {return this.reports.listFor(r.user,date,dept,search);}
 @Get("overview") overview(@Req() r:AuthenticatedRequest,@Query("date") date?:string,@Query("department_id") dept?:string,@Query("search") search?:string) {return this.reports.overview(r.user,date,dept,search);}
 @Get("kpi-definitions") definitions(@Req() r:AuthenticatedRequest) {return this.reports.definitions(r.user);}
 @Get("export") export(@Req() r:AuthenticatedRequest,@Res() res:Response,@Query("date") date?:string,@Query("department_id") dept?:string,@Query("search") search?:string,@Query("format") format?:string) {
  const reports=this.reports.listFor(r.user,date,dept,search);
  if(format==="json")return res.attachment("lyno-reports.json").json({version:1,reports});
  const cell=(v:unknown)=>'"'+String(v??"").replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';
  const rows=[["Ngày","Nhân sự","Phòng ban","Trạng thái","Tổng việc","Hoàn thành","Điểm duyệt"],...reports.map(r=>[r.date,r.authorName,r.department,r.status,r.tasks.length,r.tasks.filter(t=>t.status==="done").length,r.status==="approved"?r.score:""])];
  return res.setHeader("Content-Type","text/csv; charset=utf-8").attachment("lyno-reports.csv").send("\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n"));
 }
 @Post("import") @Roles("manager","employee") importDrafts(@Body() b:ImportReportsDto,@Req() r:AuthenticatedRequest) {return this.reports.importDrafts(r.user,b);}
 @Get("crm-tasks") tasks(@Req() r:AuthenticatedRequest,@Query("date") date?:string,@Query("include_status") includeStatus?:string){return this.crm.tasks(r.user,r.crmSessionId,date??new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date()),includeStatus==="true");}
 @Get(":id") get(@Param("id") id:string,@Req() r:AuthenticatedRequest) {return this.reports.get(id,r.user);}
 @Get(":id/history") history(@Param("id") id:string,@Req() r:AuthenticatedRequest) {return this.reports.history(id,r.user);}
 @Post() @Roles("manager","employee") create(@Body() b:CreateReportDto,@Req() r:AuthenticatedRequest) {return this.reports.create(r.user,b);}
 @Put(":id") @Roles("manager","employee") update(@Param("id") id:string,@Body() b:CreateReportDto,@Req() r:AuthenticatedRequest) {return this.reports.update(id,r.user,b);}
 @Post(":id/submit") @Roles("manager","employee") submit(@Param("id") id:string,@Body() b:VersionDto,@Req() r:AuthenticatedRequest) {return this.reports.submit(id,r.user,b);}
 @Post(":id/approve") @Roles("admin","ceo","manager") approve(@Param("id") id:string,@Body() b:ReviewReportDto,@Req() r:AuthenticatedRequest) {return this.reports.approve(id,r.user,b);}
 @Post(":id/reopen") @Roles("admin","ceo","manager") reopen(@Param("id") id:string,@Body() b:ReopenReportDto,@Req() r:AuthenticatedRequest) {return this.reports.reopen(id,r.user,b);}
}
