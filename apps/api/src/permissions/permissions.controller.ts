import { Controller, Get, UseGuards } from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer-auth.guard";
import { PermissionsAccessGuard } from "./permissions-access.guard";
import { ROLE_LABELS } from "../users/user.types";

const MATRIX = [
  { key: "reports.self", label: "Xem báo cáo cá nhân", admin: "Toàn công ty", manager: "Bản thân", employee: "Bản thân" },
  { key: "reports.team", label: "Xem báo cáo nhóm", admin: "Toàn công ty", manager: "Phòng mình", employee: "—" },
  { key: "reports.create", label: "Tạo / gửi báo cáo", admin: "Theo ủy quyền", manager: "Bản thân", employee: "Bản thân" },
  { key: "reports.review", label: "Chấm điểm / duyệt", admin: "Toàn công ty", manager: "Nhân sự phòng mình", employee: "—" },
  { key: "users.roles", label: "Quản lý vai trò", admin: "Được phép", manager: "—", employee: "—" },
  { key: "dashboard.scope", label: "Phạm vi tổng hợp", admin: "Toàn công ty", manager: "Phòng mình", employee: "Chỉ số bản thân" },
] as const;

@Controller("permissions")
@UseGuards(BearerAuthGuard, PermissionsAccessGuard)
export class PermissionsController {
  @Get()
  getMatrix() {
    return {
      roles: (Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((key) => ({
        key,
        label: ROLE_LABELS[key],
      })),
      permissions: MATRIX.map(row => ({...row, ceo: row.key === "users.roles" ? "—" : row.key === "reports.create" ? "Chưa cấp ủy quyền" : row.admin, admin: row.key === "reports.create" ? "Chưa cấp ủy quyền" : row.admin})),
    };
  }
}
