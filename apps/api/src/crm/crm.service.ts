import { BadGatewayException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { StorageService } from "../storage.service";
import { UsersService } from "../users/users.service";
import type { DemoUser } from "../users/user.types";
import type { ReportTask } from "../reports/report.types";

type Profile = { id:string; email:string; full_name:string; role:"admin"|"manager"|"employee"; active:boolean; phong_ban_id:string|null; position:string|null };
type Session = { userId:string; accessToken:string; refreshToken:string; expiresAt:number;validUntil:number };
type RecurringTask = { id:string; nguoi_id:string; ngay:string; ten:string; checklist:{ten:string;xong:boolean}[]; han:string; trang_thai:string };
type CrmTask = { id:string; tieu_de:string; mo_ta:string|null; giao_cho:string|null; priority:string; han:string|null; trang_thai:string; khong_hoan_thanh:boolean };
@Injectable()
export class CrmService {
  private readonly sessions = new Map<string,Session>();
  private readonly refreshes = new Map<string,Promise<void>>();
  constructor(private readonly storage:StorageService, private readonly users:UsersService) {}
  enabled() { return !!(process.env.CRM_API_URL && process.env.CRM_SUPABASE_URL && process.env.CRM_SUPABASE_ANON_KEY); }
  private configured() { if(!this.enabled()) throw new ServiceUnavailableException("Chưa cấu hình kết nối CRM. Cần CRM_API_URL, CRM_SUPABASE_URL và CRM_SUPABASE_ANON_KEY."); }
  private async call(url:string,init?:RequestInit,authentication: "login" | "refresh" | false=false) {
    let response:Response;
    try {response=await fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(8000)});}
    catch {throw new BadGatewayException("Không kết nối được CRM. Vui lòng thử lại.");}
    if (!response.ok && authentication) {
      const error = await response.json().catch(() => ({}));
      const code = error.error_code ?? error.code ?? error.error;
      if (authentication === "login" && code === "email_not_confirmed") {
        throw new UnauthorizedException("Email CRM chưa được xác nhận. Vui lòng xác nhận email trước khi đăng nhập.");
      }
      if ([400, 401, 403, 422].includes(response.status)) {
        throw new UnauthorizedException(authentication === "login"
          ? "Email hoặc mật khẩu CRM không chính xác. Hãy dùng tài khoản của CRM đang kết nối; tài khoản demo báo cáo không đăng nhập được ở chế độ CRM."
          : "Phiên CRM đã hết hạn. Vui lòng đăng nhập lại.");
      }
    }
    if(response.status===401)throw new UnauthorizedException("CRM không chấp nhận phiên đăng nhập hoặc tài khoản chưa có hồ sơ hoạt động trên CRM.");
    if(response.status===403)throw new ForbiddenException("Tài khoản CRM không có quyền truy cập chức năng này.");
    if(!response.ok)throw new BadGatewayException("CRM chưa trả được dữ liệu. Vui lòng thử lại.");
    return response.json();
  }
  private base() {return process.env.CRM_API_URL!.replace(/\/$/,"");}
  private async profile(session:Session):Promise<Profile> {
    const body=await this.call(this.base()+"/auth/me",{headers:{Authorization:"Bearer "+session.accessToken}});
    const profile=body?.data?.user;
    if(!profile?.active || typeof profile.id!=="string" || typeof profile.email!=="string" || typeof profile.full_name!=="string" || !["admin","manager","employee"].includes(profile.role))throw new UnauthorizedException("Hồ sơ CRM không hợp lệ.");
    if(profile.id!==session.userId)throw new UnauthorizedException("Tài khoản CRM không khớp phiên.");
    return profile;
  }
  async login(email:string,password:string) {
    this.configured();
    const result=await this.call(process.env.CRM_SUPABASE_URL!.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:process.env.CRM_SUPABASE_ANON_KEY!,"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})},"login");
    if(typeof result.access_token!=="string" || typeof result.refresh_token!=="string" || !result.user?.id)throw new UnauthorizedException("Đăng nhập CRM thất bại.");
    const session:Session={userId:result.user.id,accessToken:result.access_token,refreshToken:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in??3600)*1000,validUntil:Date.now()+4*60*60*1000};
    const profile=await this.profile(session);
    const user=this.users.syncCrm(profile);
    const recipients=await this.call(this.base()+"/viec/nguoi-nhan",{headers:{Authorization:"Bearer "+session.accessToken}});
    const person=Array.isArray(recipients?.data?.nguoi)?recipients.data.nguoi.find((p:{id:string})=>p.id===profile.id):null;
    if(typeof person?.phong==="string"&&person.phong){user.department=person.phong;this.users.setCrmDepartmentName(user.id,person.phong);}

    for(const [id,old] of this.sessions)if(old.validUntil<Date.now())this.sessions.delete(id);
    const sessionId=randomUUID();this.sessions.set(sessionId,session);
    return {user,sessionId};
  }
  async resolve(sessionId:string):Promise<DemoUser> {
    this.configured();
    const session=this.sessions.get(sessionId);
    if(!session||session.validUntil<Date.now())throw new UnauthorizedException("Phiên CRM đã hết hạn. Đăng nhập lại tài khoản CRM.");
    if(session.expiresAt<Date.now()+30000){
      let refresh=this.refreshes.get(sessionId);
      if(!refresh){
        refresh=(async()=>{
          const data=await this.call(process.env.CRM_SUPABASE_URL!.replace(/\/$/,"")+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:process.env.CRM_SUPABASE_ANON_KEY!,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refreshToken})},"refresh");
          if(typeof data.access_token!=="string"||typeof data.refresh_token!=="string")throw new UnauthorizedException("Đăng nhập lại CRM để tiếp tục.");
          session.accessToken=data.access_token;session.refreshToken=data.refresh_token;session.expiresAt=Date.now()+Number(data.expires_in??3600)*1000;
        })().finally(()=>this.refreshes.delete(sessionId));
        this.refreshes.set(sessionId,refresh);
      }
      await refresh;
    }
    return this.users.syncCrm(await this.profile(session));
  }
  async tasks(user:DemoUser,sessionId:string|undefined,date:string,includeStatus=false) {
    if(!sessionId||!user.crmUserId)throw new UnauthorizedException("Đăng nhập bằng tài khoản CRM để lấy việc được giao.");
    const resolved=await this.resolve(sessionId);
    if(resolved.id!==user.id)throw new ForbiddenException("Không thể lấy việc CRM của người khác.");
    const session=this.sessions.get(sessionId)!;
    const headers={Authorization:"Bearer "+session.accessToken};
    const [body,recurring]=await Promise.all([
      this.call(this.base()+"/viec",{headers}),
      this.call(this.base()+"/viec/lap-lai/tien-do?ngay="+encodeURIComponent(date),{headers}),
    ]);
    if(!Array.isArray(recurring?.data?.rows))throw new BadGatewayException("Danh sách việc lặp lại CRM không đúng cấu trúc.");
    if(!Array.isArray(body?.data?.mo)||!Array.isArray(body?.data?.dong))throw new BadGatewayException("Danh sách việc CRM không đúng cấu trúc.");
    const seen=new Set<string>();
    const tasks:ReportTask[]=(body.data.mo as CrmTask[]).filter(t=>t.giao_cho===user.crmUserId).filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true;}).map(t=>{
      if(typeof t.id!=="string"||typeof t.tieu_de!=="string")throw new BadGatewayException("Đầu việc CRM không hợp lệ.");
      return {crmTaskId:t.id,title:t.tieu_de.slice(0,130),expectedOutput:(t.mo_ta?.trim()||"Hoàn thành công việc được giao").slice(0,160),actualOutput:"",priority:t.priority==="low"?"low":t.priority==="medium"?"medium":"high",dueDate:t.han?.slice(0,10)||date,progress:0,status:"in_progress",evidenceUrl:"",note:""};
    });
    for(const task of recurring.data.rows as RecurringTask[]){
      if(task.nguoi_id!==user.crmUserId||task.ngay!==date)continue;
      if(typeof task.id!=="string"||typeof task.ten!=="string")throw new BadGatewayException("Việc lặp lại CRM không hợp lệ.");
      const id="recurring:"+task.id;
      if(seen.has(id))continue;
      seen.add(id);
      const expected=Array.isArray(task.checklist)?task.checklist.map(step=>step.ten).join("; "):"";
      tasks.push({crmTaskId:id,title:task.ten.slice(0,130),expectedOutput:(expected||"Hoàn thành công việc lặp lại được giao").slice(0,160),actualOutput:"",priority:"medium",dueDate:date,progress:0,status:"in_progress",evidenceUrl:"",note:""});
    }
    const known=this.storage.load<Record<string,ReportTask>>("crm.tasks:"+user.id,{});
    for(const task of tasks)known[task.crmTaskId!]=task;
    this.storage.save("crm.tasks:"+user.id,known);
    const status={
      date,
      assignedOpen:(body.data.mo as CrmTask[]).filter(t=>t.giao_cho===user.crmUserId).length,
      assignedClosed:(body.data.dong as CrmTask[]).filter(t=>t.giao_cho===user.crmUserId).length,
      availableToClaim:(body.data.mo as (CrmTask & {quyen?:{nhanDuoc?:boolean}})[]).filter(t=>!t.giao_cho&&t.quyen?.nhanDuoc===true).length,
      departmentCatalog:Array.isArray(body.data.dauViec)?body.data.dauViec.filter((d:{phong_ban_id:string})=>d.phong_ban_id===user.departmentId).length:0,
      recurringAssigned:tasks.filter(t=>t.crmTaskId?.startsWith("recurring:")).length
    };
    return includeStatus?{tasks,status}:tasks;
  }
  validateReferences(user:DemoUser,tasks:ReportTask[],date:string) {
    const known=this.storage.load<Record<string,ReportTask>>("crm.tasks:"+user.id,{});
    const seen=new Set<string>();
    for(const task of tasks){
      if(!task.crmTaskId)continue;
      const source=known[task.crmTaskId];
      if(!user.crmUserId||!source)throw new ForbiddenException("Đầu việc CRM chưa được cấp cho tài khoản của bạn.");
      if(task.crmTaskId.startsWith("recurring:")&&source.dueDate!==date)throw new ForbiddenException("Việc lặp lại phải thuộc đúng ngày báo cáo.");
      if(seen.has(task.crmTaskId))throw new ForbiddenException("Một việc CRM chỉ được báo cáo một lần trong ngày.");
      if(task.title!==source.title||task.expectedOutput!==source.expectedOutput||task.dueDate!==source.dueDate||task.priority!==source.priority)throw new ForbiddenException("Thông tin việc CRM không khớp. Tải lại việc từ CRM.");
      seen.add(task.crmTaskId);
    }
  }
}
