"use client";
import EvidenceFiles from "./evidence-files";
import { useCallback, useEffect, useRef, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV==="production"?"/api":"http://localhost:4000/api");
type User = {
  id: string;
  role: string;
  departmentId: string;
  department: string;
  crmUserId?:string;
};
type Task = {
  evidenceFiles?:string[];
  crmTaskId?:string;
  title: string;
  expectedOutput: string;
  actualOutput: string;
  priority: string;
  dueDate: string;
  progress: number;
  status: string;
  evidenceUrl: string;
  note: string;
};
type CrmTasksResponse={tasks:Task[];status:{date:string;assignedClosed:number;availableToClaim:number;departmentCatalog:number}};
function emptyCrmMessage(status:CrmTasksResponse["status"]){
 const reasons:string[]=[];
 if(status.availableToClaim)reasons.push("Có "+status.availableToClaim+" việc chưa nhận: vào CRM nhận việc cho tài khoản của bạn rồi tải lại.");
 if(status.assignedClosed)reasons.push("Có "+status.assignedClosed+" việc của bạn đã đóng trên CRM; hiện chỉ lấy việc thường đang mở.");
 if(status.departmentCatalog)reasons.push("CRM có "+status.departmentCatalog+" danh mục Đầu việc của phòng. Danh mục này chưa phải việc được giao cho cá nhân.");
 return "Chưa có việc đang mở giao trực tiếp cho bạn hoặc bản việc lặp lại ngày "+status.date+". "+reasons.join(" ");
}
type Kpi = {
  code: string;
  target: number;
  actual: number;
  resultPercent?: number | null;
};
type Definition = {
  code: string;
  name: string;
  unit: string;
  departmentId: string;
};
type Review = {
  result: number;
  responsibility: number;
  competency: number;
  improvement: number;
  comment: string;
  reviewerId: string;
  reviewedAt: string;
  version: number;
};
type Report = {
  id?: string;
  authorId?: string;
  authorName?: string;
  department?: string;
  departmentId?: string;
  date: string;
  title: string;
  summary: string;
  status: string;
  tasks: Task[];
  kpis: Kpi[];
  blockerType: string;
  blockerText: string;
  supportRequest: string;
  tomorrowPlan: string;
  selfScore: number;
  focus: string;
  attitude: string;
  lesson: string;
  version?: number;
  score?: number | null;
  reviews?: Review[];
};
type Overview = {
  submitted: number;
  totalPeople: number;
  totalTasks: number;
  done: number;
  inProgress: number;
  late: number;
  completion: number;
  averageScore: number | null;
  scoreSamples: number;
  departments: { id: string; name: string; completion: number }[];
  kpis: (Definition & Kpi)[];
  alerts: {
    reportId: string;
    author: string;
    title: string;
    message: string;
  }[];
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const labels: Record<string, string> = {
  draft: "Bản nháp",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  reopened: "Đã mở lại",
  done: "Hoàn thành",
  in_progress: "Đang làm",
  late: "Chậm",
  overdue: "Quá hạn",
};
const emptyTask = (date: string): Task => ({
  title: "",
  expectedOutput: "",
  actualOutput: "",
  priority: "high",
  dueDate: date,
  progress: 0,
  status: "in_progress",
  evidenceUrl: "",
  note: "",
});
function blank(date: string, defs: Definition[]): Report {
  return {
    date,
    title: "Báo cáo công việc",
    summary: "",
    status: "draft",
    tasks: [emptyTask(date)],
    kpis: defs.map((d) => ({ code: d.code, target: 0, actual: 0 })),
    blockerType: "none",
    blockerText: "",
    supportRequest: "",
    tomorrowPlan: "",
    selfScore: 80,
    focus: "Tốt",
    attitude: "Chủ động",
    lesson: "",
  };
}
export default function DailyWorkspace({
  token,
  user,
  mode,
  onChange,
}: {
  token: string;
  user: User;
  mode: "overview" | "reports" | "department";
  onChange: () => Promise<void>;
}) {
  const [date, setDate] = useState(today());
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [defs, setDefs] = useState<Definition[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [draft, setDraft] = useState<Report | null>(null);
  const [actionBusy, setBusy] = useState(false);
  const [uploading,setUploading]=useState(0);
  const busy=actionBusy||uploading>0;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<
    { id: number; actor: string; action: string; timestamp: string }[]
  >([]);
  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const r = await fetch(`${API}/reports${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join("; ")
            : (data.message ?? "Thao tác thất bại"),
        );
      return data;
    },
    [token],
  );
  const loadId = useRef(0);
  const load = useCallback(async () => {
    const id = ++loadId.current;
    setLoading(true);
    try {
      const q = `?date=${date}&department_id=${encodeURIComponent(department)}&search=${encodeURIComponent(search)}`;
      const [rr, oo, dd] = await Promise.all([
        api<Report[]>(q),
        api<Overview>(`/overview${q}`),
        api<Definition[]>("/kpi-definitions"),
      ]);
      if (id === loadId.current) {
        setReports(rr);
        setOverview(oo);
        setDefs(dd);
      }
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, [api, date, department, search]);
  useEffect(() => {
    let live = true;
    setError("");
    void load().catch((e) => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [load]);
  const perform = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      await onChange();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!draft) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>(".daily-modal");
    const first = dialog?.querySelector<HTMLElement>(
      "button,input,textarea,select",
    );
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setDraft(null);
      if (e.key !== "Tab" || !dialog) return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
        ),
      ).filter(
        (el) => el.offsetParent !== null && !el.closest("fieldset:disabled"),
      );
      const start = elements[0],
        end = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === start) {
        e.preventDefault();
        end?.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        start?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [!!draft, busy]);
  const ownDefs = defs.filter((d) => d.departmentId === user.departmentId);
  const editable =
    !!draft &&
    (!draft.id ||
      (draft.authorId === user.id &&
        ["draft", "reopened"].includes(draft.status)));
  const reviewable =
    !!draft?.id &&
    ["admin", "ceo", "manager"].includes(user.role) &&
    draft.authorId !== user.id;
  function change<K extends keyof Report>(key: K, value: Report[K]) {
    setDraft((r) => (r ? { ...r, [key]: value } : r));
  }
  function taskChange(i: number, key: keyof Task, value: string | number | string[]) {
    setDraft((r) =>
      r
        ? {
            ...r,
            tasks: r.tasks.map((t, j) =>
              j === i ? { ...t, [key]: value } : t,
            ),
          }
        : r,
    );
  }
  async function getCrmTasks() {
    setBusy(true);setError("");setNotice("");
    try{
      const result=await api<CrmTasksResponse>("/crm-tasks?include_status=true&date="+encodeURIComponent(draft?.date??date));
      const incoming=result.tasks;
      setDraft(current=>{
        if(!current)return current;
        const ids=new Set(current.tasks.map(t=>t.crmTaskId).filter(Boolean));
        const additions=incoming.filter(t=>!ids.has(t.crmTaskId));
        const updated=current.tasks.filter(t=>t.title.trim()||t.actualOutput.trim()).map(t=>{
          const source=incoming.find(item=>item.crmTaskId&&item.crmTaskId===t.crmTaskId);
          return source?{...t,title:source.title,expectedOutput:source.expectedOutput,priority:source.priority,dueDate:source.dueDate}:t;
        });
        return {...current,tasks:[...updated,...additions]};
      });
      if(!incoming.length)setNotice(emptyCrmMessage(result.status));
    }catch(e){setError(e instanceof Error?e.message:"Không lấy được việc từ CRM.");}
    finally{setBusy(false);}
  }
  async function newReport() {
    setError("");setNotice("");setHistory([]);
    const next=blank(date,ownDefs);
    if(!user.crmUserId){setDraft(next);return;}
    setBusy(true);
    try{const result=await api<CrmTasksResponse>("/crm-tasks?include_status=true&date="+encodeURIComponent(date));next.tasks=result.tasks;setDraft(next);if(!next.tasks.length)setNotice(emptyCrmMessage(result.status));}
    catch(e){setError(e instanceof Error?e.message:"Không lấy được việc từ CRM.");}
    finally{setBusy(false);}
  }
  async function open(r: Report) {
    setError("");
    try {
      const item = await api<Report>(`/${r.id}`);
      const logs = await api<typeof history>(`/${r.id}/history`);
      item.kpis = defs
        .filter((d) => d.departmentId === item.departmentId)
        .map(
          (d) =>
            item.kpis.find((k) => k.code === d.code) ?? {
              code: d.code,
              target: 0,
              actual: 0,
            },
        );
      setDraft(item);
      setHistory(logs);
      setScores([0, 0, 0, 0]);
      setComment("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không mở được báo cáo");
    }
  }
  async function save(status: "draft" | "submitted") {
    if (!draft||busy) return;
    await perform(
      async () => {
        const {
          date,
          title,
          summary,
          tasks,
          kpis,
          blockerType,
          blockerText,
          supportRequest,
          tomorrowPlan,
          selfScore,
          focus,
          attitude,
          lesson,
          version,
        } = draft;
        await api(draft.id ? `/${draft.id}` : "", {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify({
            date,
            title,
            summary,
            status,
            tasks,
            kpis: kpis.map(({ code, target, actual }) => ({
              code,
              target,
              actual,
            })),
            blockerType,
            blockerText,
            supportRequest,
            tomorrowPlan,
            selfScore,
            focus,
            attitude,
            lesson,
            ...(version ? { version } : {}),
          }),
        });
        setDraft(null);
      },
      status === "draft" ? "Đã lưu nháp" : "Đã gửi báo cáo",
    );
  }
  async function importJson(file:File) {
  await perform(async()=>{
   const backup=JSON.parse(await file.text()) as {reports?:Report[]};
   if(!Array.isArray(backup.reports)||backup.reports.length>300)throw new Error("JSON cần danh sách reports, tối đa 300 bản nháp.");
   const items=backup.reports.map(r=>{
    const {authorId,date,title,summary,status,tasks,kpis,blockerType,blockerText,supportRequest,tomorrowPlan,selfScore,focus,attitude,lesson,version}=r;
    return {authorId,date,title,summary,status,tasks,kpis:kpis.map(({code,target,actual})=>({code,target,actual})),blockerType,blockerText,supportRequest,tomorrowPlan,selfScore,focus,attitude,lesson,version};
   });
   await api("/import",{method:"POST",body:JSON.stringify({reports:items})});
  },"Đã nhập bản nháp. Báo cáo đã duyệt được phục hồi qua sao lưu CSDL.");
 }
 async function carryForward() {
  await perform(async()=>{
   const items=await api<Report[]>("");
   const previous=items.filter(r=>r.authorId===user.id&&r.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];
   if(!previous)throw new Error("Chưa có báo cáo ngày trước để chuyển việc.");
   const tasks=previous.tasks.filter(t=>t.status!=="done");
   if(!tasks.length)throw new Error("Không có việc tồn đọng trong báo cáo trước.");
   setDraft(r=>r?{...r,tasks:[...r.tasks.filter(t=>t.title.trim()),...tasks]}:r);
  },"Đã chuyển việc tồn đọng. Kiểm tra lại trước khi lưu.");
 }
 function download(name: string, data: string, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  function csv() {
    const cell = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Ngày",
        "Nhân sự",
        "Phòng ban",
        "Trạng thái",
        "Tổng việc",
        "Hoàn thành",
        "Điểm duyệt",
      ],
      ...reports.map((r) => [
        r.date,
        r.authorName,
        r.department,
        labels[r.status],
        r.tasks.length,
        r.tasks.filter((t) => t.status === "done").length,
        r.status === "approved" ? r.score : "",
      ]),
    ];
    download(
      `lyno-${date}.csv`,
      "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="daily-workspace">
      <div className="panel daily-filters">
        <label>
          Ngày báo cáo
          <input
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Phòng ban
          <select
            className="form-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">
              {["admin", "ceo"].includes(user.role)
                ? "Tất cả phòng ban"
                : user.department}
            </option>
            {Array.from(new Map([
              ...defs.map(d=>[d.departmentId,({marketing:"Marketing",sales:"Sale/CSKH",hr:"Hành chính/HR",it:"IT",operations:"Kho/Vận hành",design:"Thiết kế/Sản phẩm"} as Record<string,string>)[d.departmentId]??d.departmentId] as [string,string]),
              ...(overview?.departments??[]).map(d=>[d.id,d.name] as [string,string]),
              ...reports.map(r=>[r.departmentId??"",r.department??""] as [string,string])
            ]).entries()).filter(([id])=>id).map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          Tìm tên / mã nhân sự
          <input
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên hoặc mã nhân sự"
          />
        </label>
        <button className="outline-button" onClick={csv}>
          Xuất CSV
        </button>
        <button
          className="outline-button"
          onClick={() =>
            download(
              `lyno-${date}.json`,
              JSON.stringify({ version: 1, date, reports }, null, 2),
              "application/json",
            )
          }
        >
          Xuất JSON
        </button>
        {user.role !== "ceo" && (
          <button
            className="button button-primary"
            disabled={busy||loading}
            onClick={() => void newReport()}
          >
            Tạo báo cáo
          </button>
        )}
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {loading && <p role="status">Đang tải dữ liệu…</p>}
      {overview && mode !== "reports" && (
        <>
          <div className="metric-grid">
            {[
              [
                "ĐÃ NỘP / NHÂN SỰ",
                `${overview.submitted} / ${overview.totalPeople}`,
              ],
              ["TỔNG ĐẦU VIỆC", overview.totalTasks],
              ["TỶ LỆ HOÀN THÀNH", `${overview.completion.toFixed(0)}%`],
              ["CHẬM / QUÁ HẠN", overview.late],
            ].map(([label, value]) => (
              <article className="metric-card" key={label}>
                <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-glyph" aria-hidden="true">{label === "ĐÃ NỘP / NHÂN SỰ" ? "▤" : label === "TỔNG ĐẦU VIỆC" ? "▦" : label === "TỶ LỆ HOÀN THÀNH" ? "✓" : "!"}</span></div>
                <strong className="metric-value">{value}</strong>
                <span className="metric-note">{label === "ĐÃ NỘP / NHÂN SỰ" ? "Báo cáo đã gửi trong ngày" : label === "TỔNG ĐẦU VIỆC" ? "Công việc trong phạm vi đang xem" : label === "TỶ LỆ HOÀN THÀNH" ? `${overview.done} công việc hoàn thành` : "Cần theo dõi và hỗ trợ kịp thời"}</span>
              </article>
            ))}
          </div>
          <div className="dashboard-charts">
            <section className="panel chart-panel"><div className="panel-heading"><h2>Hiệu suất phòng ban</h2><span className="subtle">Tỷ lệ hoàn thành công việc</span></div>
              {overview.departments.length ? <div className="chart-bars">{overview.departments.map(d => <div className="bar-col" key={d.id}><strong>{d.completion.toFixed(0)}%</strong><div className="chart-bar" style={{height: `${Math.max(0, Math.min(100, d.completion)) * 1.5}px`}} /><span>{d.name}</span></div>)}</div> : <p className="empty-chart">Chưa có dữ liệu phòng ban trong ngày.</p>}
            </section>
            <section className="panel chart-panel"><div className="panel-heading"><h2>Trạng thái công việc</h2><span className="subtle">{overview.totalTasks} đầu việc</span></div><div className="donut-wrap"><div className="donut" role="img" aria-label={`Hoàn thành ${overview.done}, đang làm ${overview.inProgress}, chậm hoặc quá hạn ${overview.late}`} style={{background: overview.totalTasks ? `conic-gradient(#189b69 0 ${overview.done / overview.totalTasks * 100}%, #3278db ${overview.done / overview.totalTasks * 100}% ${(overview.done + overview.inProgress) / overview.totalTasks * 100}%, #d84d60 ${(overview.done + overview.inProgress) / overview.totalTasks * 100}% 100%)` : '#ecf1f6'}}><div className="donut-center"><strong>{overview.completion.toFixed(0)}%</strong><small>Hoàn thành</small></div></div><div className="chart-legend">{[["Hoàn thành", overview.done, "#189b69"], ["Đang làm", overview.inProgress, "#3278db"], ["Chậm / quá hạn", overview.late, "#d84d60"]].map(([label, value, color]) => <div key={label}><span><i style={{background: String(color)}} />{label}</span><b>{value}</b></div>)}</div></div></section>
          </div>
      {mode==="overview"&&["manager","ceo","admin"].includes(user.role)&&<section className="panel daily-panel">
        <h2>Nội dung công việc và tiến độ nhân viên</h2>
        <p className="form-hint">Tiến độ theo % nhân viên đã chọn trong báo cáo ngày đang xem.</p>
        <div className="employee-task-grid">{reports.flatMap(report=>report.tasks.map((task,index)=><article className="employee-task-card" key={report.id+":"+index}>
          <div className="employee-task-heading"><div><strong>{report.authorName}</strong><small>{report.department} · {labels[report.status]}</small></div><b>{task.progress}%</b></div>
          <h3>{task.title}{task.crmTaskId&&<small className="crm-task-tag">{task.crmTaskId.startsWith("recurring:")?"CRM · Lặp lại":"CRM"}</small>}</h3>
          <div className="employee-work-content"><span>Nội dung đã làm</span><p>{task.actualOutput||"Chưa nhập nội dung đã làm."}</p></div>
          <progress className="task-progress-bar" value={task.progress} max={100} aria-label={"Tiến độ "+task.title}/>
          <button className="text-button" onClick={()=>void open(report)}>Xem báo cáo</button>
        </article>))}</div>
        {!reports.some(r=>r.tasks.length>0)&&!loading&&<p>Chưa có nội dung công việc trong ngày được chọn.</p>}
      </section>}
          <div className="content-grid">
            <section className="panel daily-panel">
              <h2>Kết quả & đánh giá trong ngày</h2>
              <p>
                Hoàn thành: {overview.done} · Đang làm: {overview.inProgress} ·
                Chậm/quá hạn: {overview.late}
              </p>
              <p>
                Điểm quản lý trung bình:{" "}
                {overview.averageScore?.toFixed(1) ?? "—"} (
                {overview.scoreSamples} báo cáo đã duyệt)
              </p>
            </section>
            <section className="panel daily-panel">
              <h2>Cảnh báo cần xử lý</h2>
              {overview.alerts.length ? (
                overview.alerts.map((a, i) => (
                  <button
                    className="daily-alert"
                    key={i}
                    onClick={() => {
                      const r = reports.find((r) => r.id === a.reportId);
                      if (r) void open(r);
                    }}
                  >
                    <strong>
                      {a.author} · {a.message}
                    </strong>
                    <span>{a.title}</span>
                  </button>
                ))
              ) : (
                <p>Không có cảnh báo đầu việc.</p>
              )}
            </section>
          </div>
        </>
      )}
      <section className="panel daily-panel">
        <h2>
          {mode === "department"
            ? "Nhân sự trong phòng ban"
            : "Báo cáo theo ngày"}
        </h2>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Báo cáo</th>
                <th>Đầu việc</th>
                <th>Hoàn thành</th>
                <th>Chậm</th>
                <th>Trạng thái</th>
                <th>Điểm</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.authorName}</strong>
                    <small>{r.department}</small>
                  </td>
                  <td>{r.title}</td>
                  <td>{r.tasks.length}</td>
                  <td>
                    {r.tasks.length
                      ? Math.round(
                          (r.tasks.filter((t) => t.status === "done").length /
                            r.tasks.length) *
                            100,
                        )
                      : 0}
                    %
                  </td>
                  <td>
                    {
                      r.tasks.filter((t) =>
                        ["late", "overdue"].includes(t.status),
                      ).length
                    }
                  </td>
                  <td>{labels[r.status]}</td>
                  <td>{r.status === "approved" ? r.score : "—"}</td>
                  <td>
                    <button
                      className="outline-button"
                      onClick={() => void open(r)}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!reports.length && !loading && (
          <p>Chưa có báo cáo phù hợp với bộ lọc.</p>
        )}
      </section>
      {mode === "department" && overview && (
        <>
          <section className="panel daily-panel">
            <h2>KPI phòng ban</h2>
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Chỉ số</th>
                    <th>Đơn vị</th>
                    <th>Mục tiêu</th>
                    <th>Thực đạt</th>
                    <th>Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.kpis.map((k) => (
                    <tr key={`${k.departmentId}-${k.code}`}>
                      <td>{k.departmentId}</td>
                      <td>{k.name}</td>
                      <td>{k.unit}</td>
                      <td>{k.target}</td>
                      <td>{k.actual}</td>
                      <td>
                        {k.resultPercent == null
                          ? "—"
                          : `${k.resultPercent.toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel daily-panel">
            <h2>Vướng mắc và đề xuất hỗ trợ</h2>
            {reports
              .filter((r) => r.blockerType !== "none")
              .map((r) => (
                <p key={r.id}>
                  <strong>{r.authorName}</strong>: {r.blockerText} · Hỗ trợ:{" "}
                  {r.supportRequest || "Chưa đề xuất"}
                </p>
              ))}
          </section>
        </>
      )}
      {draft && (
        <div className="modal-backdrop">
          <div
            className="report-modal daily-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-title"
          >
            {user.crmUserId&&notice&&<div className="alert alert-success" role="status">{notice}</div>}
            <div className="modal-heading">
              <h2 id="daily-title">
                {draft.id
                  ? `${draft.authorName} · ${labels[draft.status]}`
                  : "Báo cáo cá nhân"}
              </h2>
              <button className="outline-button" disabled={busy} onClick={() => setDraft(null)}>
                Đóng
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save("submitted");
              }}
            >
              <fieldset disabled={!editable || busy}>
                <div className="daily-form-grid">
                  <label>
                    Ngày
                    <input
                      className="form-input"
                      type="date"
                      value={draft.date}
                      disabled={!!draft.id}
                      required
                      onChange={(e) => change("date", e.target.value)}
                    />
                  </label>
                  <label>
                    Tiêu đề
                    <input
                      className="form-input"
                      value={draft.title}
                      maxLength={120}
                      required
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </label>
                </div>
                <h3>Đầu việc ({draft.tasks.length})</h3>{user.crmUserId&&<button type="button" disabled={busy} className="outline-button" onClick={()=>void getCrmTasks()}>Lấy thêm việc từ CRM</button>}{!draft.id&&<button type="button" className="outline-button" onClick={()=>void carryForward()}>Chuyển việc tồn từ ngày trước</button>}
                <p className="form-hint">
                  Ưu tiên 3 việc chính/ngày. Có thể thêm việc phát sinh.
                </p>
                {draft.tasks.map((t, i) => (
                  <div className="daily-task" key={i}>
                    <div className="modal-heading">
                      <strong>Việc {i + 1}{t.crmTaskId&&<small className="crm-task-tag">{t.crmTaskId.startsWith("recurring:")?"CRM · Lặp lại":"Từ CRM"}</small>}</strong>
                      <button
                        type="button"
                        className="outline-button"
                        onClick={() =>
                          change(
                            "tasks",
                            draft.tasks.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Xóa
                      </button>
                    </div>
                    <div className="daily-form-grid">
                      {(
                        [
                          ["title", "Tên công việc", 130],
                          ["expectedOutput", "Đầu ra kỳ vọng", 160],
                          
                          ["evidenceUrl", "Link minh chứng HTTPS", 1000],
                          ["note", "Ghi chú / phối hợp", 240],
                        ] as const
                      ).map(([key, label, max]) => (
                        <label key={key}>
                          {label}
                          <input
                            className="form-input"
                            value={t[key]}
                            readOnly={!!t.crmTaskId&&(key==="title"||key==="expectedOutput")}
                            maxLength={max}
                            required={
                              key === "title" ||
                              key === "expectedOutput"
                            }
                            type={key === "evidenceUrl" ? "url" : "text"}
                            onChange={(e) => taskChange(i, key, e.target.value)}
                          />
                        </label>
                      ))}
                      <label>
                        Ưu tiên
                        <select
                          className="form-input"
                          value={t.priority}
                        disabled={!!t.crmTaskId||!editable||busy}
                          onChange={(e) =>
                            taskChange(i, "priority", e.target.value)
                          }
                        >
                          <option value="high">Cao</option>
                          <option value="medium">Trung bình</option>
                          <option value="low">Thấp</option>
                        </select>
                      </label>
                      <label>
                        Hạn hoàn thành
                        <input
                          className="form-input"
                          type="date"
                          value={t.dueDate}
                          readOnly={!!t.crmTaskId}
                          required
                          onChange={(e) =>
                            taskChange(i, "dueDate", e.target.value)
                          }
                        />
                      </label>
                      <label className="task-work-content">
                        Nội dung việc đã làm
                        <textarea className="form-input form-textarea" value={t.actualOutput} maxLength={2000} required={t.progress===100} placeholder="Nhập những phần đã thực hiện, kết quả và việc còn lại…" onChange={e=>taskChange(i,"actualOutput",e.target.value)}/>
                      </label>
                      <label>
                        % đã hoàn thành
                        <select className="form-input" value={t.progress} onChange={e=>{
                          const value=Number(e.target.value);
                          setDraft(r=>r?{...r,tasks:r.tasks.map((task,j)=>j===i?{...task,progress:value,status:value===100?"done":task.status==="done"?"in_progress":task.status}:task)}:r);
                        }}>
                          {[...new Set([...Array.from({length:11},(_,i)=>i*10),t.progress])].sort((a,b)=>a-b).map(value=><option key={value} value={value}>{value}%</option>)}
                        </select>
                        <progress className="task-progress-bar" max={100} value={t.progress} aria-label={"Tiến độ "+t.title}/>
                      </label>
                      <label>
                        Trạng thái
                        <select
                          className="form-input"
                          value={t.status}
                          onChange={(e) =>
                            taskChange(i, "status", e.target.value)
                          }
                        >
                          {["done", "in_progress", "late", "overdue"].map(
                            (s) => (
                              <option key={s} value={s}>
                                {labels[s]}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    {editable&&<EvidenceFiles token={token} ids={t.evidenceFiles} disabled={busy} onBusyChange={v=>setUploading(n=>n+(v?1:-1))} onChange={ids=>taskChange(i,"evidenceFiles",ids)}/>}
                    {t.status === "done" && !t.evidenceUrl && !t.evidenceFiles?.some(Boolean) && (
                      <p className="form-hint">
                        Cảnh báo: việc hoàn thành chưa có minh chứng.
                      </p>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="outline-button"
                  onClick={() =>
                    change("tasks", [...draft.tasks, emptyTask(draft.date)])
                  }
                >
                  + Thêm đầu việc
                </button>
                <h3>KPI theo phòng ban</h3>
                {draft.kpis.map((k, i) => {
                  const d = defs.find(
                    (d) =>
                      d.code === k.code &&
                      d.departmentId ===
                        (draft.departmentId ?? user.departmentId),
                  );
                  return (
                    <div className="daily-kpi" key={k.code}>
                      <strong>
                        {d?.name ?? k.code} ({d?.unit})
                      </strong>
                      {(["target", "actual"] as const).map((key) => (
                        <label key={key}>
                          {key === "target" ? "Mục tiêu" : "Thực đạt"}
                          <input
                            className="form-input"
                            type="number"
                            step="any"
                            min={0}
                            value={k[key]}
                            required
                            onChange={(e) =>
                              change(
                                "kpis",
                                draft.kpis.map((v, j) =>
                                  j === i
                                    ? { ...v, [key]: Number(e.target.value) }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                      <span>
                        {k.target
                          ? `${((k.actual / k.target) * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                    </div>
                  );
                })}
                <h3>Vướng mắc và kế hoạch</h3>
                <label>
                  Loại vướng mắc
                  <select
                    className="form-input"
                    value={draft.blockerType}
                    onChange={(e) => change("blockerType", e.target.value)}
                  >
                    {[
                      ["none", "Không có"],
                      ["skill", "Thiếu kỹ năng"],
                      ["information", "Thiếu thông tin"],
                      ["tools", "Thiếu công cụ"],
                      ["dependency", "Chờ bộ phận khác"],
                      ["process", "Vướng quy trình"],
                      ["other", "Khác"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ["summary", "Tóm tắt kết quả", 1000],
                    ["blockerText", "Mô tả vướng mắc", 600],
                    ["supportRequest", "Đề xuất hỗ trợ", 600],
                    ["tomorrowPlan", "Kế hoạch ngày mai (tối đa 3 dòng)", 1200],
                    ["lesson", "Bài học / cần cải thiện", 600],
                  ] as const
                ).map(([key, label, max]) => (
                  <label className="daily-text-field" key={key}>
                    {label}
                    <textarea
                      className="form-input form-textarea"
                      maxLength={max}
                      value={draft[key]}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
                <div className="daily-form-grid">
                  <label>
                    Tự đánh giá (0–100)
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selfScore}
                      required
                      onChange={(e) =>
                        change("selfScore", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Tập trung
                    <select
                      className="form-input"
                      value={draft.focus}
                      onChange={(e) => change("focus", e.target.value)}
                    >
                      {["Tốt", "Trung bình", "Cần cải thiện"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Thái độ
                    <select
                      className="form-input"
                      value={draft.attitude}
                      onChange={(e) => change("attitude", e.target.value)}
                    >
                      {["Chủ động", "Bình thường", "Bị động"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              {!editable&&draft.tasks.map((t,i)=><section key={i}><h3>Minh chứng · {t.title}</h3><EvidenceFiles token={token} ids={t.evidenceFiles} disabled onChange={()=>{}}/></section>)}
              {editable && (
                <div className="modal-actions">
                  <button
                    type="button"
                    className="outline-button"
                    disabled={busy}
                    onClick={() => void save("draft")}
                  >
                    Lưu nháp
                  </button>
                  <button className="button button-primary" disabled={busy}>
                    Gửi báo cáo
                  </button>
                </div>
              )}
            </form>
            {!!draft.reviews?.length && (
              <section>
                <h3>Lịch sử đánh giá</h3>
                {draft.reviews.map((r) => (
                  <div className="daily-task" key={r.version}>
                    <strong>
                      Phiên bản {r.version} ·{" "}
                      {r.result +
                        r.responsibility +
                        r.competency +
                        r.improvement}
                      /100
                    </strong>
                    <p>{r.comment}</p>
                    <small>
                      {r.reviewerId} ·{" "}
                      {new Date(r.reviewedAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </small>
                  </div>
                ))}
              </section>
            )}
            {reviewable && draft.status === "submitted" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await api(`/${draft.id}/approve`, {
                      method: "POST",
                      body: JSON.stringify({
                        version: draft.version,
                        result: scores[0],
                        responsibility: scores[1],
                        competency: scores[2],
                        improvement: scores[3],
                        comment,
                      }),
                    });
                    setDraft(null);
                  }, "Đã duyệt và khóa báo cáo");
                }}
              >
                <h3>Chấm điểm và duyệt</h3>
                <div className="score-grid">
                  {["Kết quả", "Trách nhiệm", "Năng lực", "Cải thiện"].map(
                    (s, i) => (
                      <label className="score-field" key={s}>
                        {s} / {[40, 30, 20, 10][i]}
                        <input
                          type="number"
                          min={0}
                          max={[40, 30, 20, 10][i]}
                          value={scores[i]}
                          required
                          onChange={(e) =>
                            setScores(
                              scores.map((v, j) =>
                                j === i ? Number(e.target.value) : v,
                              ),
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
                <label>
                  Nhận xét quản lý (bắt buộc)
                  <textarea
                    className="form-input form-textarea"
                    required
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button className="button button-primary" disabled={busy}>
                  Duyệt báo cáo
                </button>
              </form>
            )}
            {reviewable && draft.status === "approved" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await api(`/${draft.id}/reopen`, {
                      method: "POST",
                      body: JSON.stringify({ version: draft.version, reason }),
                    });
                    setDraft(null);
                  }, "Đã mở lại. Nhân sự có thể sửa và gửi lại.");
                }}
              >
                <label>
                  Lý do mở lại
                  <textarea
                    className="form-input form-textarea"
                    required
                    maxLength={600}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="outline-button" disabled={busy}>
                  Mở lại báo cáo
                </button>
              </form>
            )}
            {!!history.length && (
              <details>
                <summary>Nhật ký thay đổi ({history.length})</summary>
                {history.map((h) => (
                  <p key={h.id}>
                    {new Date(h.timestamp).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}{" "}
                    · {h.actor} · {h.action}
                  </p>
                ))}
              </details>
            )}
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="outline-button daily-print"
              onClick={() => window.print()}
            >
              In báo cáo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
