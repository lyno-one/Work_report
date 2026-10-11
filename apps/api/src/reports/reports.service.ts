import { AttachmentsService } from "../attachments/attachments.service";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CrmService } from "../crm/crm.service";
import { StorageService } from "../storage.service";
import { UsersService } from "../users/users.service";
import type { DemoUser } from "../users/user.types";
import type { CreateReportDto, ImportReportsDto, ReopenReportDto, VersionDto } from "./create-report.dto";
import type { ReviewReportDto } from "./review-report.dto";
import type { WorkReport } from "./report.types";
import { KpiCatalogService } from "./kpi-catalog.service";
@Injectable()
export class ReportsService {
 private reports: WorkReport[];
 constructor(private readonly storage: StorageService, private readonly users: UsersService, private readonly crm:CrmService,private readonly attachments:AttachmentsService,private readonly catalog:KpiCatalogService) {
    const seed = [
    {
      id: "rep-1001",
      authorId: "usr-employee",
      authorName: "Nguyễn Thị Mai",
      departmentId: "marketing",
      department: "Marketing",
      date: "2026-10-10",
      title: "Hoàn thiện nội dung chiến dịch tháng 10",
      summary: "Hoàn thiện 4 bài viết; chờ duyệt hình ảnh cho bài ra mắt sản phẩm.",
      status: "submitted",
      score: null,
      reviewer: null,
    },
    {
      id: "rep-1002",
      authorId: "usr-manager",
      authorName: "Trần Văn Sơn",
      departmentId: "marketing",
      department: "Marketing",
      date: "2026-10-10",
      title: "Rà soát lịch nội dung tuần",
      summary: "Đã chốt lịch đăng cho tuần tới và phân công người phụ trách.",
      status: "approved",
      score: 86,
      reviewer: "Lê Minh Anh",
    },
    {
      id: "rep-1003",
      authorId: "usr-sale-manager",
      authorName: "Nguyễn Kim Liên",
      departmentId: "sales",
      department: "Sale/CSKH",
      date: "2026-10-10",
      title: "Tổng hợp phản hồi khách hàng",
      summary: "Tổng hợp 12 phản hồi; chuyển 3 vấn đề sản phẩm sang đội phụ trách.",
      status: "submitted",
      score: null,
      reviewer: null,
    },
    {
      id: "rep-1004",
      authorId: "usr-hr",
      authorName: "Phạm Thu Thảo",
      departmentId: "hr",
      department: "Hành chính/HR",
      date: "2026-10-10",
      title: "Cập nhật hồ sơ nhân sự",
      summary: "Đã cập nhật hồ sơ nhân sự mới và lịch hướng dẫn hội nhập.",
      status: "draft",
      score: null,
      reviewer: null,
    },
    ];

 this.reports = storage.load<WorkReport[]>("reports", process.env.NODE_ENV==="test" ? seed.map(r => ({...r, status: r.status as WorkReport["status"],
 tasks: [{title:r.title,expectedOutput:"Hoàn thành và bàn giao",actualOutput:r.status === "approved" ? r.summary : "",priority:"high",dueDate:r.date,progress:r.status === "approved" ? 100 : 60,status:r.status === "approved" ? "done" : "in_progress",evidenceUrl:"",note:""}],
 kpis: [], blockerType:"none",blockerText:"",supportRequest:"",tomorrowPlan:"",selfScore:80,focus:"Tốt",attitude:"Chủ động",lesson:"",version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),submittedAt:r.status === "draft" ? null : new Date().toISOString(),approvedAt:r.status === "approved" ? new Date().toISOString() : null,
 reviews:r.status === "approved" ? [{result:34,responsibility:26,competency:18,improvement:8,comment:"Đã kiểm tra kết quả.",reviewerId:"usr-admin",reviewedAt:new Date().toISOString(),version:1}] : []
 })) : []);
 }
 private decorate(r:WorkReport):WorkReport {const user=this.users.findById(r.authorId);return {...r,employeeCode:user?.employeeCode,jobTitle:user?.jobTitle};}
 private allowed(user: DemoUser, report: WorkReport) { return ["admin","ceo"].includes(user.role) || user.role === "manager" && report.departmentId === user.departmentId || report.authorId === user.id; }
 listFor(user: DemoUser, date?: string, departmentId?: string, search?: string): WorkReport[] {
  return structuredClone(this.reports.filter(r => this.allowed(user,r) && (!date || r.date === date) && (!departmentId || r.departmentId === departmentId) && (!search || `${r.authorName} ${this.users.findById(r.authorId)?.employeeCode??""}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))).map(r=>this.decorate(r)));
 }
 get(id: string,user: DemoUser): WorkReport { const r=this.reports.find(r => r.id === id); if(!r) throw new NotFoundException("Không tìm thấy báo cáo"); if(!this.allowed(user,r)) throw new ForbiddenException("Báo cáo nằm ngoài quyền truy cập"); return structuredClone(this.decorate(r)); }
 private validate(input: CreateReportDto, departmentId: string) {
  const validDate=(d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if(!validDate(input.date)) throw new BadRequestException("Ngày báo cáo không hợp lệ");
  if(!input.title.trim()) throw new BadRequestException("Nhập tiêu đề báo cáo");
  if(input.status === "submitted" && !input.tasks.length) throw new UnprocessableEntityException("Cần ít nhất một đầu việc trước khi gửi");
  if(input.tomorrowPlan.split(/\r?\n/).filter(s => s.trim()).length > 3) throw new BadRequestException("Kế hoạch ngày mai tối đa 3 việc");
  for(const t of input.tasks) {
   if(!t.title.trim() || !t.expectedOutput.trim() || !validDate(t.dueDate)) throw new BadRequestException("Đầu việc cần tên, đầu ra kỳ vọng và hạn hợp lệ");
   if(t.status === "done" && (t.progress !== 100 || !t.actualOutput.trim())) throw new UnprocessableEntityException("Việc hoàn thành cần tiến độ 100% và kết quả thực tế");
   if(t.evidenceUrl) { try { const url=new URL(t.evidenceUrl); if(url.protocol !== "https:") throw new Error(); } catch { throw new BadRequestException("Link minh chứng phải là URL HTTPS hợp lệ"); } }
  }
  const codes=new Set<string>();
  for(const k of input.kpis) { const def=this.catalog.all().find(d => d.departmentId === departmentId && d.code === k.code); if(!def || codes.has(k.code)) throw new BadRequestException("KPI không hợp lệ hoặc bị trùng"); codes.add(k.code); }
 }
 private write(actor: DemoUser, action: string, report: WorkReport, before: WorkReport | null) {
  const next=this.reports.filter(r => r.id !== report.id); next.unshift(report);
  this.storage.commit("reports",next,actor.id,report.id,action,before,report); this.reports=next; return structuredClone(report);
 }
 create(user: DemoUser,input: CreateReportDto): WorkReport {
  if(["admin","ceo"].includes(user.role)) throw new ForbiddenException("Chưa có ủy quyền tạo báo cáo");
  this.validate(input,user.departmentId);
  this.crm.validateReferences(user,input.tasks,input.date);this.attachments.validate(user,input.tasks);
  if(this.reports.some(r => r.authorId === user.id && r.date === input.date)) throw new ConflictException("Bạn đã có báo cáo ngày này. Hãy mở bản hiện có để sửa.");
  const now=new Date().toISOString();
  return this.write(user,"report.create",{...input,id:randomUUID(),authorId:user.id,authorName:user.name,departmentId:user.departmentId,department:user.department,version:1,score:null,reviewer:null,createdAt:now,updatedAt:now,submittedAt:input.status === "submitted" ? now : null,approvedAt:null,reviews:[],kpis:input.kpis.map(k => ({...k,resultPercent:k.target === 0 ? null : k.actual/k.target*100}))},null);
 }
 importDrafts(user: DemoUser,input: ImportReportsDto) {
  const seen=new Set<string>();
  const entries=input.reports.map(item=>{
   if(item.authorId && item.authorId!==user.id) throw new ForbiddenException("Chỉ nhập bản nháp của chính mình");
   if(item.status!=="draft") throw new BadRequestException("JSON chỉ cho phép nhập bản nháp; lịch sử duyệt cần phục hồi từ sao lưu CSDL");
   this.validate(item,user.departmentId);
   this.crm.validateReferences(user,item.tasks,item.date);this.attachments.validate(user,item.tasks);
   if(seen.has(item.date))throw new ConflictException("JSON chứa ngày báo cáo trùng nhau");
   seen.add(item.date);
   const before=this.reports.find(r=>r.authorId===user.id&&r.date===item.date)??null;
   if(before) {
    if(!["draft","reopened"].includes(before.status))throw new ForbiddenException("Không nhập đè báo cáo đã gửi hoặc đã duyệt");
    this.checkVersion(before,item.version);
   }
   const now=new Date().toISOString();
   const {authorId:ignored,version:ignoredVersion,...data}=item;
   const after:WorkReport={...data,id:before?.id??randomUUID(),authorId:user.id,authorName:user.name,departmentId:user.departmentId,department:user.department,status:before?.status==="reopened"?"reopened":"draft",score:null,reviewer:null,version:(before?.version??0)+1,createdAt:before?.createdAt??now,updatedAt:now,submittedAt:before?.submittedAt??null,approvedAt:null,reviews:before?.reviews??[],kpis:item.kpis.map(k=>({...k,resultPercent:k.target?k.actual/k.target*100:null}))};
   return {actor:user.id,entity:after.id,action:"report.import",before,after};
  });
  const next=[...entries.map(e=>e.after),...this.reports.filter(r=>!entries.some(e=>e.entity===r.id))];
  this.storage.commitBatch("reports",next,entries);this.reports=next;return {imported:entries.length};
 }
 private checkVersion(r: WorkReport,version: number | undefined) { if(version !== r.version) throw new ConflictException("Báo cáo đã thay đổi. Tải lại trước khi thao tác."); }
 update(id: string,user: DemoUser,input: CreateReportDto) {
  const r=this.get(id,user); this.checkVersion(r,input.version);
  if(r.authorId !== user.id || !["draft","reopened"].includes(r.status)) throw new ForbiddenException("Chỉ sửa nháp hoặc báo cáo được mở lại của mình");
  if(input.date !== r.date) throw new BadRequestException("Không thể đổi ngày của báo cáo đã tạo");
  this.crm.validateReferences(user,input.tasks,input.date);this.attachments.validate(user,input.tasks);
  this.validate(input,r.departmentId); const now=new Date().toISOString();
  return this.write(user,"report.update",{...r,...input,status:input.status === "submitted" ? "submitted" : r.status,version:r.version+1,updatedAt:now,submittedAt:input.status === "submitted" ? now : r.submittedAt,kpis:input.kpis.map(k => ({...k,resultPercent:k.target === 0 ? null : k.actual/k.target*100}))},r);
 }
 submit(id: string,user: DemoUser,input: VersionDto) { const r=this.get(id,user); return this.update(id,user,{...r,...input,status:"submitted"}); }
 private canReview(r: WorkReport,user: DemoUser) {
  if(!["admin","ceo","manager"].includes(user.role) || user.role === "manager" && r.departmentId !== user.departmentId) throw new ForbiddenException("Không được duyệt báo cáo ngoài phạm vi");
  if(r.authorId === user.id) throw new ForbiddenException("Không thể tự duyệt báo cáo của mình");
 }
 approve(id: string,user: DemoUser,review: ReviewReportDto) {
  const r=this.get(id,user); this.canReview(r,user); this.checkVersion(r,review.version);
  if(r.status !== "submitted") throw new UnprocessableEntityException("Chỉ duyệt báo cáo đã gửi");
  if(!review.comment.trim()) throw new BadRequestException("Bắt buộc nhập nhận xét quản lý");
  const now=new Date().toISOString();
  return this.write(user,"report.approve",{...r,status:"approved",version:r.version+1,updatedAt:now,approvedAt:now,score:review.result+review.responsibility+review.competency+review.improvement,reviewer:user.name,reviews:[...r.reviews,{...review,reviewerId:user.id,reviewedAt:now,version:r.reviews.length+1}]},r);
 }
 reopen(id: string,user: DemoUser,input: ReopenReportDto) {
  const r=this.get(id,user); this.canReview(r,user); this.checkVersion(r,input.version);
  if(r.status !== "approved") throw new UnprocessableEntityException("Chỉ mở lại báo cáo đã duyệt");
  if(!input.reason.trim()) throw new BadRequestException("Bắt buộc nêu lý do mở lại");
  const result=this.write(user,`report.reopen: ${input.reason.trim()}`,{...r,status:"reopened",score:null,reviewer:null,approvedAt:null,version:r.version+1,updatedAt:new Date().toISOString()},r); return result;
 }
 history(id: string,user: DemoUser) { this.get(id,user); return this.storage.history(id); }
 definitions(user: DemoUser) { return this.catalog.all().filter(d => ["admin","ceo"].includes(user.role) || d.departmentId === user.departmentId); }
 overview(user: DemoUser,date?: string,departmentId?: string,search?: string) {
  const reports=this.listFor(user,date,departmentId,search); const tasks=reports.flatMap(r => r.tasks);
  const people=this.users.list().filter(u => u.active && !["admin","ceo"].includes(u.role) && (["admin","ceo"].includes(user.role) || user.role === "manager" && u.departmentId === user.departmentId || u.id === user.id) && (!departmentId || u.departmentId === departmentId) && (!search || `${u.name} ${u.employeeCode??""}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
  const done=tasks.filter(t => t.status === "done").length;
  const approved=reports.filter(r => r.status === "approved");
  return { people:people.map(u=>({id:u.id,name:u.name,employeeCode:u.employeeCode,jobTitle:u.jobTitle,department:u.department})),reports:reports.length,submitted:reports.filter(r => ["submitted","approved"].includes(r.status)).length,totalPeople:people.length,totalTasks:tasks.length,done,inProgress:tasks.filter(t => t.status === "in_progress").length,late:tasks.filter(t => ["late","overdue"].includes(t.status)).length,completion:tasks.length ? done/tasks.length*100 : 0,averageScore:approved.length ? approved.reduce((a,r)=>a+(r.score ?? 0),0)/approved.length : null,scoreSamples:approved.length,
   departments:[...new Set(people.map(u => u.departmentId))].map(id => { const rr=reports.filter(r=>r.departmentId===id),tt=rr.flatMap(r=>r.tasks); return {id,name:people.find(u=>u.departmentId===id)!.department,completion:tt.length ? tt.filter(t=>t.status === "done").length/tt.length*100 : 0}; }),
   kpis:this.catalog.all().filter(d => (!departmentId || d.departmentId === departmentId) && (["admin","ceo"].includes(user.role) || d.departmentId === user.departmentId)).map(d => {const kk=reports.filter(r=>r.departmentId === d.departmentId).flatMap(r=>r.kpis.filter(k=>k.code === d.code));const target=kk.reduce((a,k)=>a+k.target,0),actual=kk.reduce((a,k)=>a+k.actual,0);return {...d,target,actual,resultPercent:target ? actual/target*100 : null};}),
   alerts:reports.flatMap(r => r.tasks.filter(t => t.status !== "done" && (t.dueDate < (date ?? new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date())) || ["late","overdue"].includes(t.status)) || t.status === "done" && !t.evidenceUrl && !t.evidenceFiles?.some(Boolean)).map(t => ({reportId:r.id,author:r.authorName,title:t.title,message:t.status === "done" ? "Thiếu minh chứng" : "Chậm / quá hạn"})))
  };
 }
 leaderboard(month?:string,departmentId?:string) {
  const selected=month??new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).slice(0,7);
  if(!/^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(selected))throw new BadRequestException("Tháng phải có dạng YYYY-MM.");
  const year=Number(selected.slice(0,4));
  const approved=this.reports.filter(r=>r.status==="approved"&&r.score!==null&&Number.isFinite(r.score)&&r.date.slice(0,4)===String(year));
  const departments=new Map<string,string>();
  for(const u of this.users.list())if(u.active&&!["admin","ceo"].includes(u.role))departments.set(u.departmentId,u.department);
  for(const r of approved)departments.set(r.departmentId,r.department);
  if(departmentId&&!departments.has(departmentId))throw new BadRequestException("Phòng ban không tồn tại.");
  type Entry={userId:string;name:string;departmentId:string;department:string;monthScore:number;yearScore:number;monthReports:number;yearReports:number};
  const entries=new Map<string,Entry>();
  // Filtering follows the department stored on each report.
  for(const r of approved.filter(r=>!departmentId||r.departmentId===departmentId)){
   let row=entries.get(r.authorId);
   if(!row){row={userId:r.authorId,name:this.users.findById(r.authorId)?.name??r.authorName,departmentId:r.departmentId,department:r.department,monthScore:0,yearScore:0,monthReports:0,yearReports:0};entries.set(r.authorId,row);}
   row.yearScore+=r.score!;row.yearReports++;
   if(r.date.slice(0,7)===selected){row.monthScore+=r.score!;row.monthReports++;}
  }
  const rank=(key:"monthScore"|"yearScore",count:"monthReports"|"yearReports")=>{
   const sorted=[...entries.values()].filter(r=>r[count]>0).sort((a,b)=>b[key]-a[key]||a.name.localeCompare(b.name,"vi")||a.userId.localeCompare(b.userId));
   let position=0;return sorted.map((r,i)=>{if(i===0||r[key]!==sorted[i-1][key])position=i+1;return {...r,rank:position};});
  };
  return {month:selected,year,departments:[...departments].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,"vi")),monthly:rank("monthScore","monthReports"),yearly:rank("yearScore","yearReports")};
 }

}
