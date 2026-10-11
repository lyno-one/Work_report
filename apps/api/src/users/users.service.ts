import { StorageService } from "../storage.service";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { DemoUser, UserRole } from "./user.types";

@Injectable()
export class UsersService {
  private readonly users: DemoUser[];
  constructor(private readonly storage: StorageService) { this.users = storage.load<DemoUser[]>("users", process.env.NODE_ENV==="test" ? [
    {
      id: "usr-admin",
      name: "Lê Minh Anh",
      email: "admin@lyno.demo",
      role: "admin",
      departmentId: "executive",
      department: "Ban điều hành",
      active: true,
    },
    {
      id: "usr-manager",
      name: "Trần Văn Sơn",
      email: "manager@lyno.demo",
      role: "manager",
      departmentId: "marketing",
      department: "Marketing",
      active: true,
    },
    {
      id: "usr-employee",
      name: "Nguyễn Thị Mai",
      email: "employee@lyno.demo",
      role: "employee",
      departmentId: "marketing",
      department: "Marketing",
      active: true,
    },
    {
      id: "usr-sale-manager",
      name: "Nguyễn Kim Liên",
      email: "lien@lyno.demo",
      role: "manager",
      departmentId: "sales",
      department: "Sale/CSKH",
      active: true,
    },
    {
      id: "usr-hr",
      name: "Phạm Thu Thảo",
      email: "thao@lyno.demo",
      role: "employee",
      departmentId: "hr",
      department: "Hành chính/HR",
      active: true,
    },
  ] : []);
    if (process.env.NODE_ENV==="test" && !this.users.some(u => u.id === "usr-ceo")) {
      this.users.push({id:"usr-ceo",name:"Ban điều hành",email:"ceo@lyno.demo",role:"ceo",departmentId:"executive",department:"Ban điều hành",active:true});
      this.storage.save("users", this.users);
    }
    this.enrichUsers();
  }

  private enrichUsers() {
    for(const [i,user] of this.users.entries()) {
      user.employeeCode ??= "LY"+String(i+1).padStart(3,"0");
      user.jobTitle ??= user.role==="manager"?"Trưởng phòng":user.role==="employee"?"Nhân viên":"Ban điều hành";
      user.managerId ??= user.id==="usr-employee"?"usr-manager":null;
    }
    this.storage.save("users",this.users);
  }

  findById(id: string): DemoUser | undefined {
    return this.users.find((user) => user.id === id);
  }

  findByEmail(email: string): DemoUser | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  list(): DemoUser[] {
    return this.users.map((user) => ({ ...user }));
  }

  setCrmDepartmentName(id:string,name:string){
    const user=this.findById(id);if(!user?.crmUserId)return;
    user.department=name;this.storage.save("users",this.users);
    const names=this.storage.read<Record<string,string>>("crm.department-names")??{};names[user.departmentId]=name;this.storage.save("crm.department-names",names);
  }

  syncCrm(profile:{id:string;email:string;full_name:string;role:"admin"|"manager"|"employee";active:boolean;phong_ban_id:string|null;position:string|null}):DemoUser {
    const existing=this.findById(profile.id);
    const before=existing?{...existing}:null;
    const user:DemoUser={...existing,id:profile.id,crmUserId:profile.id,name:profile.full_name,email:profile.email,role:profile.role==="admin"&&existing?.role==="ceo"?"ceo":profile.role,departmentId:profile.phong_ban_id??"crm-unassigned:"+profile.id,department:existing?.departmentId===profile.phong_ban_id?existing.department:profile.phong_ban_id??"Chưa gán phòng",active:profile.active,jobTitle:profile.position??"",employeeCode:existing?.employeeCode??profile.id.slice(0,8)};
    if(existing)Object.assign(existing,user);else this.users.push(user);
    if(JSON.stringify(before)!==JSON.stringify(user))this.storage.commit("users",this.users,profile.id,profile.id,"crm.profile.sync",before,user);
    return {...user};
  }

  updateRole(id: string, role: UserRole, actorId: string): DemoUser {
    if (id === actorId) {
      throw new ConflictException("Không thể tự thay đổi vai trò của tài khoản đang đăng nhập");
    }
    const user = this.findById(id);
    if (!user) throw new NotFoundException("Không tìm thấy nhân sự");
    if(user.crmUserId && !(["admin","ceo"].includes(user.role) && ["admin","ceo"].includes(role)))throw new BadRequestException("Vai trò nhân viên/quản lý CRM phải thay đổi tại CRM; báo cáo chỉ hỗ trợ gán CEO cho admin CRM.");
    const before = { ...user };
    user.role = role;
    try { this.storage.commit("users", this.users, actorId, user.id, "role.change", before, user); } catch (error) { user.role = before.role; throw error; }
    return { ...user };
  }
}
