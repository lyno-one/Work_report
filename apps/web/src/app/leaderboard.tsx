"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL??(process.env.NODE_ENV==="production"?"/api":"http://localhost:4000/api");
function currentMonth(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).slice(0,7);}
type Row={userId:string;name:string;department:string;monthScore:number;yearScore:number;monthReports:number;yearReports:number;rank:number};
type Data={month:string;year:number;departments:{id:string;name:string}[];monthly:Row[];yearly:Row[]};
export default function Leaderboard({token,userId}:{token:string;userId:string}){
 const [month,setMonth]=useState(currentMonth),[followCurrent,setFollowCurrent]=useState(true),[department,setDepartment]=useState(""),[period,setPeriod]=useState<"monthly"|"yearly">("monthly"),[data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const [departments,setDepartments]=useState<Data["departments"]>([]);
 useEffect(()=>{const timer=setInterval(()=>{if(followCurrent)setMonth(currentMonth());setRefresh(n=>n+1);},60000);return()=>clearInterval(timer);},[followCurrent]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");setData(null);
  const query=new URLSearchParams({month});if(department)query.set("department_id",department);
  void fetch(API+"/leaderboard?"+query,{headers:{Authorization:"Bearer "+token},signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message??"Không tải được bảng xếp hạng");return body as Data;}).then(body=>{setData(body);setDepartments(body.departments);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[token,month,department,refresh]);
 const rows=data?.[period]??[];
 return <section className="leaderboard-panel">
  <div className="section-heading"><div><h2>Bảng xếp hạng</h2><p className="muted">Cộng điểm báo cáo đã duyệt theo ngày báo cáo. Tổng năm giữ nguyên khi sang tháng mới.</p></div></div>
  <div className="leaderboard-filters">
   <label>Tháng<input className="form-input" type="month" value={month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setFollowCurrent(false);}}}/></label>
   <label>Phạm vi<select className="form-input" value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Toàn công ty</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>Xếp theo<select className="form-input" value={period} onChange={e=>setPeriod(e.target.value as "monthly"|"yearly")}><option value="monthly">Điểm tháng</option><option value="yearly">Điểm năm</option></select></label>
   <button className="outline-button" onClick={()=>{setMonth(currentMonth());setFollowCurrent(true);setRefresh(n=>n+1);}}>Tháng hiện tại</button>
   <button className="outline-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Làm mới</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {loading?<p>Đang tải bảng xếp hạng…</p>:data&&<>
   <p className="muted">{period==="monthly"?"BXH tháng "+data.month:"BXH năm "+data.year} · {rows.length} người có báo cáo đã duyệt · Điểm bằng nhau cùng hạng</p>
   <div className="leaderboard-table-wrap"><table className="leaderboard-table"><thead><tr><th>Hạng</th><th>Nhân viên</th><th>Phòng ban</th><th>Điểm tháng</th><th>Điểm năm</th><th>Báo cáo đã duyệt</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.userId} className={r.userId===userId?"leaderboard-self":""}><td><strong>{r.rank}</strong></td><td>{r.name}{r.userId===userId&&" (Bạn)"}</td><td>{r.department}</td><td>{r.monthScore}</td><td>{r.yearScore}</td><td>{period==="monthly"?r.monthReports:r.yearReports}</td></tr>)}
    {!rows.length&&<tr><td colSpan={6}>Chưa có báo cáo được duyệt trong kỳ này.</td></tr>}
   </tbody></table></div>
  </>}
 </section>;
}
