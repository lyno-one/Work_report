export type UserRole = "admin" | "ceo" | "manager" | "employee";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  department: string;
  active: boolean;
  crmUserId?: string;
  employeeCode?: string;
  jobTitle?: string;
  managerId?: string | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  ceo: "CEO",
  manager: "Manager",
  employee: "Employee",
};
