"use client";

import Image from "next/image";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import SupportCenter from "./support-center";
import Leaderboard from "./leaderboard";
import DailyWorkspace from "./daily-workspace";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV==="production"?"/api":"http://localhost:4000/api");

type Role = "admin" | "ceo" | "manager" | "employee";
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string;
  department: string;
  active: boolean;
  crmUserId?:string;
  canManagePermissions?:boolean;
};
type Report = {
  id: string;
  authorId: string;
  authorName: string;
  departmentId: string;
  department: string;
  date: string;
  title: string;
  summary: string;
  status: "draft" | "submitted" | "approved";
  score: number | null;
  reviewer: string | null;
};
type Permission = {
  key: string;
  label: string;
  admin: string;
  ceo: string;
  manager: string;
  employee: string;
};

const roleName: Record<Role, string> = {
  admin: "Admin",
  ceo: "CEO",
  manager: "Manager",
  employee: "Employee",
};
async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Yêu cầu thất bại (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [crmEnabled,setCrmEnabled]=useState(false);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<"overview" | "reports" | "permissions" | "department" | "leaderboard">("overview");
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const refreshReports = useCallback(async (activeToken: string) => {
    const items = await request<Report[]>("/reports", activeToken);
    setReports(items);
  }, []);

  const refreshUsers = useCallback(async (activeToken: string) => {
    const items = await request<User[]>("/users", activeToken);
    setUsers(items);
  }, []);

  const refreshPermissions = useCallback(async (activeToken: string) => {
    const result = await request<{ permissions: Permission[] }>("/permissions", activeToken);
    setPermissions(result.permissions);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("lyno-token");
    setToken("");
    setUser(null);
    setReports([]);
    setUsers([]);
    setPage("overview");
  }, []);

  const loadWorkspace = useCallback(async (activeToken: string) => {
    const { user: currentUser } = await request<{ user: User }>("/auth/me", activeToken);
    setUser(currentUser);
    await refreshReports(activeToken);
    if(currentUser.canManagePermissions)await Promise.all([refreshPermissions(activeToken),refreshUsers(activeToken)]);
    else {setPermissions([]);setUsers([]);setPage(p=>p==="permissions"?"overview":p);}
  }, [refreshPermissions, refreshReports, refreshUsers]);

  useEffect(()=>{void fetch(API+"/auth/config").then(r=>r.json()).then(data=>setCrmEnabled(!!data.crmEnabled)).catch(()=>setLoginError("Không kết nối được máy chủ."));},[]);

  useEffect(() => {
    const saved = localStorage.getItem("lyno-token");
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    void loadWorkspace(saved)
      .catch(() => signOut())
      .finally(() => setLoading(false));
  }, [loadWorkspace, signOut]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const response = await fetch(`${API}/auth/crm-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Đăng nhập thất bại");
      localStorage.setItem("lyno-token", body.accessToken);
      setToken(body.accessToken);
      await loadWorkspace(body.accessToken);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Không thể kết nối API");
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  async function act(action: () => Promise<void>, successMessage: string) {
    setActionError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      setNotice(successMessage);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, role: Role) {
    if (!token) return;
    await act(async () => {
      await request<User>(`/users/${id}/role`, token, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await refreshUsers(token);
      await refreshReports(token);
    }, "Đã cập nhật vai trò. Quyền được tải lại từ máy chủ ở request tiếp theo.");
  }

  if (loading) {
    return <main className="loading-screen"><div className="loading-mark">L</div><p>Đang kết nối LYNO…</p></main>;
  }

  if (!user || !token) {
    return (
      <main className="login-layout">
        <section className="login-brand">
          <a className="brand-lockup" href="#" aria-label="LynoMe"><Image className="login-brand-logo" src="/lynome-logo.jpg" alt="Logo LynoMe" width={617} height={324} priority /></a>
          <div className="login-pitch">
            <span className="eyebrow">THIÊN KHUÊ S · WORKSPACE</span>
            <h1>Công việc rõ ràng.<br /><span>Kết quả minh bạch.</span></h1>
            <p>Một không gian để mỗi người tập trung vào việc quan trọng, quản lý nhìn thấy tiến độ và đội ngũ cùng tiến về phía trước.</p>
          </div>
          <div className="login-footer">HỆ THỐNG SỬ DỤNG NỘI BỘ <span>•</span> 2026</div>
        </section>
        <section className="login-panel">
          <form className="login-card" onSubmit={signIn}>
            <div className="mobile-brand"><span className="brand-mark">L</span> LYNO<span className="brand-dot">.</span></div>
            <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
            <h2>Đăng nhập</h2>
            <p className="muted">Đăng nhập bằng tài khoản CRM để lấy việc được giao và báo cáo tiến độ.</p>
            <label className="field-label" htmlFor="email">Email công việc</label>
            <div className="input-wrap"><Users size={17} /><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <label className="field-label" htmlFor="password">Mật khẩu</label>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            {loginError && <p className="inline-error" role="alert">{loginError}</p>}
            <button className="button button-primary login-submit" disabled={busy||!crmEnabled}>{busy ? "Đang xác thực…" : "Đăng nhập"} <ArrowRight size={17} /></button>

          </form>
        </section>
      </main>
    );
  }

  const canReview = ["admin", "ceo", "manager"].includes(user.role);
  const isAdmin = !!user.canManagePermissions;
  const pendingCount = reports.filter((report) => report.status === "submitted").length;
  const selectedTitle = page === "overview" ? "Tổng quan" : page === "reports" ? "Báo cáo công việc" : page === "department" ? "Tổng hợp phòng ban" : page === "leaderboard" ? "Bảng xếp hạng" : "Phân quyền";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup sidebar-brand" href="#"><span className="brand-mark">L</span><span>LYNO<span className="brand-dot">.</span></span></a>
        <div className="workspace-switch"><span className="workspace-icon">TK</span><span><strong>Thiên Khuê S</strong><small>Workspace nội bộ</small></span><ChevronDown size={15} /></div>
        <span className="nav-label">KHÔNG GIAN LÀM VIỆC</span>
        <nav className="side-nav" aria-label="Điều hướng chính">
          <button className={page === "overview" ? "active" : ""} onClick={() => setPage("overview")}><LayoutDashboard size={17} />Tổng quan</button>
          <button className={page === "reports" ? "active" : ""} onClick={() => setPage("reports")}><ClipboardList size={17} />Báo cáo công việc{canReview && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>
          {user.role !== "employee" && <button className={page === "department" ? "active" : ""} onClick={() => setPage("department")}><Building2 size={17} />Tổng hợp phòng ban</button>}
          <button className={page === "leaderboard" ? "active" : ""} onClick={() => setPage("leaderboard")}><Users size={17} />Bảng xếp hạng</button>
          {isAdmin && <button className={page === "permissions" ? "active" : ""} onClick={() => setPage("permissions")}><ShieldCheck size={17} />Phân quyền</button>}
          {isAdmin && <button className="sub-nav" onClick={() => setPage("permissions")}><Users size={16} />Quản lý vai trò</button>}
        </nav>
        <div className="sidebar-bottom">
          <SupportCenter key={user.id} token={token} role={user.role} />
          <div className="current-user">
            <span className={`avatar avatar-${user.role}`}>{user.name.split(" ").slice(-1)[0].slice(0, 1)}</span>
            <span className="current-user-info"><strong>{user.name}</strong><small>{roleName[user.role]} · {user.department}</small></span>
            <button className="icon-button" title="Đăng xuất" aria-label="Đăng xuất" onClick={signOut}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>LYNO</span><span className="crumb-slash">/</span><strong>{selectedTitle}</strong></div>
          <div className="topbar-right">
            <span className="today-chip"><CalendarDays size={15} /> {new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}</span>
            <span className={`role-chip role-chip-${user.role}`}><span />{roleName[user.role]}</span>
            <button className="icon-button signout-small" title="Đăng xuất" onClick={signOut}><LogOut size={17} /></button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">HIỆU SUẤT MỖI NGÀY</span><h1>{selectedTitle}</h1>
              <p>{["admin", "ceo"].includes(user.role) ? "Theo dõi hoạt động và quyền truy cập trên toàn hệ thống." : user.role === "manager" ? `Không gian quản lý · ${user.department}` : "Tập trung vào tiến độ và kết quả công việc của bạn."}</p>
            </div>
          </div>

          {actionError && <div className="alert alert-error" role="alert"><X size={17} />{actionError}<button onClick={() => setActionError("")}><X size={15} /></button></div>}
          {notice && <div className="alert alert-success" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}

          {page === "leaderboard" && <Leaderboard token={token} userId={user.id} />}
          {(page === "overview" || page === "reports" || page === "department") && <DailyWorkspace token={token} user={user} mode={page} onChange={() => refreshReports(token)} />}

          {page === "permissions" && isAdmin && (
            <div className="permissions-layout">
              <section className="panel full-panel">
                <div className="panel-heading permissions-heading"><div><span className="eyebrow">ACCESS CONTROL · RBAC</span><h2>Ma trận vai trò & quyền hạn</h2><p>Quyền được áp dụng ở NestJS API. Giao diện chỉ phản ánh quyền đã xác thực.</p></div><span className="matrix-lock"><LockKeyhole size={17} /> SERVER ENFORCED</span></div>
                <div className="permission-table-wrap"><table className="permission-table"><thead><tr><th>CHỨC NĂNG</th><th><span className="table-role role-admin-dot" />ADMIN</th><th>CEO</th><th><span className="table-role role-manager-dot" />MANAGER</th><th><span className="table-role role-employee-dot" />EMPLOYEE</th></tr></thead>
                  <tbody>{permissions.map((permission) => <tr key={permission.key}><td><strong>{permission.label}</strong></td><td><PermissionValue value={permission.admin} active /></td><td><PermissionValue value={permission.ceo} active={permission.ceo !== "—"} /></td><td><PermissionValue value={permission.manager} active={permission.manager !== "—"} /></td><td><PermissionValue value={permission.employee} active={permission.employee !== "—"} /></td></tr>)}</tbody>
                </table></div>
                <div className="matrix-footnote"><ShieldCheck size={16} /><span>Manager chỉ thao tác với nhân sự trong phòng ban được gán. Employee chỉ đọc / tạo báo cáo của chính mình. Máy chủ từ chối request vượt quyền kể cả khi gọi API trực tiếp.</span></div>
              </section>
              {isAdmin ? (
                <section className="panel full-panel user-access-panel">
                  <div className="panel-heading"><div><span className="eyebrow">CRM ACCESS</span><h2>Quản lý vai trò</h2><p>Chỉ hai email CRM được chỉ định được quản lý. Vai trò nhân viên/quản lý đồng bộ từ CRM; có thể gán CEO cho admin CRM.</p></div><span className="users-count"><Users size={16} />{users.length} thành viên</span></div>
                  <div className="permission-table-wrap"><table className="user-table"><thead><tr><th>NHÂN SỰ</th><th>PHÒNG BAN</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th></tr></thead>
                    <tbody>{users.map((member) => <tr key={member.id}><td><div className="member-cell"><span className={`avatar avatar-${member.role}`}>{member.name.split(" ").slice(-1)[0].slice(0, 1)}</span><span><strong>{member.name}</strong><small>{member.email}</small></span></div></td><td>{member.department}</td><td><select aria-label={`Vai trò của ${member.name}`} className={`role-select role-select-${member.role}`} value={member.role} disabled={member.id === user.id || busy || !!member.crmUserId&&!["admin","ceo"].includes(member.role)} onChange={(event) => void changeRole(member.id, event.target.value as Role)}>{((member.crmUserId?["admin","ceo"].includes(member.role)?["admin","ceo"]:[member.role]:["admin", "ceo", "manager", "employee"]) as Role[]).map((role) => <option value={role} key={role}>{roleName[role]}</option>)}</select>{member.id === user.id && <small className="self-note">Tài khoản hiện tại</small>}</td><td><span className="active-status"><span /> Đang hoạt động</span></td></tr>)}</tbody>
                  </table></div>
                  <p className="admin-warning"><CircleHelp size={15} /> Không thể tự thay đổi vai trò tài khoản đang đăng nhập.</p>
                </section>
              ) : (
                <section className="access-callout"><LockKeyhole size={18} /><div><strong>Quản lý vai trò dành cho Admin</strong><p>Bạn đang xem ma trận quyền ở chế độ chỉ đọc. Liên hệ Admin để đề xuất thay đổi quyền truy cập.</p></div></section>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function PermissionValue({ value, active }: { value: string; active: boolean }) {
  return <span className={`permission-value ${active ? "permission-enabled" : "permission-disabled"}`}>{active && value !== "Toàn công ty" && value !== "Được phép" && <Check size={13} />}{value}</span>;
}

export default App;
