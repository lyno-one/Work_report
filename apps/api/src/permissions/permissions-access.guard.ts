import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { DemoUser } from "../users/user.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
const EMAILS=new Set(["luanduiga2605@gmail.com","nguyenvanthanh1501bmt@gmail.com"]);
export function canManagePermissions(user:DemoUser){return !!user.active&&!!user.crmUserId&&EMAILS.has(user.email.trim().toLowerCase());}
@Injectable()
export class PermissionsAccessGuard implements CanActivate {
 canActivate(context:ExecutionContext){
  const {user,crmSessionId}=context.switchToHttp().getRequest<AuthenticatedRequest>();
  if(!crmSessionId||!canManagePermissions(user))throw new ForbiddenException("Chỉ hai tài khoản CRM được chỉ định mới có quyền quản lý phân quyền.");
  return true;
 }
}
