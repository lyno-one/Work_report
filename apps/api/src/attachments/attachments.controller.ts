import { Controller, Get, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors, ForbiddenException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { ReportsService } from "../reports/reports.service";
import { AttachmentsService } from "./attachments.service";
@Controller("attachments")
@UseGuards(BearerAuthGuard,RolesGuard)
export class AttachmentsController {
 constructor(private readonly files:AttachmentsService,private readonly reports:ReportsService){}
 @Post() @Roles("employee","manager")
 @UseInterceptors(FileInterceptor("file",{limits:{fileSize:5*1024*1024,files:1,fields:0}}))
 upload(@Req() req:AuthenticatedRequest,@UploadedFile() file:{originalname:string;mimetype:string;buffer:Buffer;size:number}){return this.files.upload(req.user,file);}
 private accessible(id:string,req:AuthenticatedRequest){
  const file=this.files.get(id);
  if(file.ownerId!==req.user.id&&!this.reports.listFor(req.user).some(r=>r.tasks.some(t=>t.evidenceFiles?.includes(id))))throw new ForbiddenException("Bạn không có quyền xem file này.");
  return file;
 }
 @Get(":id/info") info(@Param("id") id:string,@Req() req:AuthenticatedRequest){return this.files.metadata(this.accessible(id,req));}
 @Get(":id") download(@Param("id") id:string,@Req() req:AuthenticatedRequest,@Res() res:Response){
  const f=this.accessible(id,req);
  return res.setHeader("Cache-Control","private, no-store").setHeader("X-Content-Type-Options","nosniff").setHeader("Content-Security-Policy","sandbox").attachment(f.name).type(f.mime).send(Buffer.from(f.data,"base64"));
 }
}
