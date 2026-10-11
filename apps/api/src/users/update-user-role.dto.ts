import { IsIn } from "class-validator";
import type { UserRole } from "./user.types";

export class UpdateUserRoleDto {
  @IsIn(["admin", "ceo", "manager", "employee"])
  role!: UserRole;
}
