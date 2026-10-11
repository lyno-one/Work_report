import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { randomUUID } from "node:crypto";
import { StorageService } from "../storage.service";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import type { DemoUser } from "../users/user.types";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
export class HelpRequestDto {
 @IsString() @MinLength(1) @MaxLength(120) title!:string;
 @IsString() @MinLength(1) @MaxLength(2000) message!:string;
}
type HelpRequest={id:string;title:string;message:string;senderId:string;senderName:string;departmentId:string;department:string;source:"crm"|"demo";createdAt:string;readBy:Record<string,string>};
@Injectable()
export class SupportService {
 constructor(private readonly storage:StorageService){}
 private requests(){return this.storage.read<HelpRequest[]>("support.requests")??[];}
 private visible(r:HelpRequest,u:DemoUser){
  return u.active&&r.senderId!==u.id&&r.source===(u.crmUserId?"crm":"demo")&&(u.role==="admin"||u.role==="manager"&&r.departmentId===u.departmentId);
 }
 create(user:DemoUser,input:HelpRequestDto){
  const title=input.title.trim(),message=input.message.trim();
  if(!title||!message)throw new BadRequestException("Nhập tiêu đề và lời nhắn.");
  const r:HelpRequest={id:randomUUID(),title,message,senderId:user.id,senderName:user.name,departmentId:user.departmentId,department:user.department,source:user.crmUserId?"crm":"demo",createdAt:new Date().toISOString(),readBy:{}};
  this.storage.commit("support.requests",[r,...this.requests()],user.id,r.id,"support.send",null,{...r,readBy:undefined});
  return {id:r.id,createdAt:r.createdAt,message:"Đã gửi yêu cầu. Manager của phòng và Admin sẽ nhận thông báo trong ứng dụng."};
 }
 inbox(user:DemoUser){
  const visible=this.requests().filter(r=>this.visible(r,user));
  return {unread:visible.filter(r=>!r.readBy[user.id]).length,items:visible.slice(0,100).map(({readBy,source,...r})=>({...r,readAt:readBy[user.id]??null}))};
 }
 read(id:string,user:DemoUser){
  const rows=this.requests(),r=rows.find(r=>r.id===id);
  if(!r)throw new NotFoundException("Không tìm thấy thông báo.");
  if(!this.visible(r,user))throw new ForbiddenException("Bạn không có quyền xem thông báo này.");
  if(!r.readBy[user.id]){
   const before={...r,readBy:{...r.readBy}};r.readBy[user.id]=new Date().toISOString();
   this.storage.commit("support.requests",rows,user.id,r.id,"support.read",before,r);
  }
  return {id:r.id,readAt:r.readBy[user.id]};
 }
}
@Controller("support")
@UseGuards(BearerAuthGuard,RolesGuard)
export class SupportController {
 constructor(private readonly support:SupportService){}
 @Post("requests") create(@Req() req:AuthenticatedRequest,@Body() body:HelpRequestDto){return this.support.create(req.user,body);}
 @Get("notifications") @Roles("manager","admin")
 inbox(@Req() req:AuthenticatedRequest){return this.support.inbox(req.user);}
 @Post("notifications/:id/read") @Roles("manager","admin")
 read(@Param("id") id:string,@Req() req:AuthenticatedRequest){return this.support.read(id,req.user);}
}
