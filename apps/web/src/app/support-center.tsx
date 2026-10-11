"use client";
import { useCallback,useEffect,useRef,useState,type FormEvent } from "react";
import { ArrowRight,Bell,CircleHelp,X } from "lucide-react";
const API=process.env.NEXT_PUBLIC_API_URL??(process.env.NODE_ENV==="production"?"/api":"http://localhost:4000/api");
type Notification={id:string;title:string;message:string;senderName:string;department:string;createdAt:string;readAt:string|null};
type Inbox={unread:number;items:Notification[]};
export default function SupportCenter({token,role}:{token:string;role:string}){
 const [mode,setMode]=useState<"help"|"inbox"|null>(null),[title,setTitle]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[inbox,setInbox]=useState<Inbox>({unread:0,items:[]});
 const [inboxError,setInboxError]=useState("");
 const heading=useRef<HTMLHeadingElement>(null);
 const receives=["manager","admin"].includes(role);
 const refresh=useCallback(async()=>{
  if(!receives)return;
  try{const r=await fetch(API+"/support/notifications",{headers:{Authorization:"Bearer "+token}});const b=await r.json();if(!r.ok)throw Error(b.message??"Không tải được thông báo.");setInbox(b);setInboxError("");}
  catch(e){setInboxError(e instanceof Error?e.message:"Không tải được thông báo.");}
 },[token,receives]);
 useEffect(()=>{if(!receives)return;void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[refresh,receives]);
 useEffect(()=>{if(!mode)return;const before=document.body.style.overflow;document.body.style.overflow="hidden";heading.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)setMode(null);};document.addEventListener("keydown",escape);return()=>{document.body.style.overflow=before;document.removeEventListener("keydown",escape);};},[mode,busy]);
 async function send(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
  try{const r=await fetch(API+"/support/requests",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({title:title.trim(),message:message.trim()})});const b=await r.json();if(!r.ok)throw Error(b.message??"Không gửi được yêu cầu.");setNotice(b.message);setTitle("");setMessage("");}
  catch(e){setError(e instanceof Error?e.message:"Không gửi được yêu cầu.");}finally{setBusy(false);}
 }
 async function markRead(id:string){
  setBusy(true);setError("");
  try{const r=await fetch(API+"/support/notifications/"+id+"/read",{method:"POST",headers:{Authorization:"Bearer "+token}});if(!r.ok){const b=await r.json();throw Error(b.message??"Không cập nhật được thông báo.");}await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Không cập nhật được thông báo.");}finally{setBusy(false);}
 }
 function open(next:"help"|"inbox"){setError("");setNotice("");setMode(next);if(next==="inbox")void refresh();}
 return <div className="support-controls">
  <button type="button" className="help-card" aria-label="Cần trợ giúp?" onClick={()=>open("help")}><CircleHelp size={18}/><span><strong>Cần trợ giúp?</strong><small>Gửi lời nhắn cho quản lý</small></span><ArrowRight size={15}/></button>
  {receives&&<button type="button" className="support-inbox-button" aria-label={"Thông báo trợ giúp: "+inbox.unread+" chưa đọc"} onClick={()=>open("inbox")}><Bell size={18}/><span>Thông báo trợ giúp</span>{inbox.unread>0&&<b className="support-badge">{inbox.unread>99?"99+":inbox.unread}</b>}</button>}
  {mode&&<div className="modal-backdrop support-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)setMode(null);}}>
   <section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-heading">
    <div className="support-heading"><h2 id="support-heading" tabIndex={-1} ref={heading}>{mode==="help"?"Cần trợ giúp?":"Thông báo trợ giúp"}</h2><button type="button" className="icon-button" aria-label="Đóng trợ giúp" disabled={busy} onClick={()=>setMode(null)}><X size={20}/></button></div>
    {error&&<p role="alert" className="alert alert-error">{error}</p>}
    {mode==="help"?<form className="support-form" onSubmit={send}>
     <p className="muted">Yêu cầu sẽ được gửi đến Manager của phòng bạn và Admin.</p>
     <label>Tiêu đề<input className="form-input" name="title" value={title} maxLength={120} required disabled={busy} onChange={e=>setTitle(e.target.value)}/></label>
     <label>Lời nhắn<textarea className="form-input form-textarea" name="message" value={message} maxLength={2000} rows={6} required disabled={busy} onChange={e=>setMessage(e.target.value)}/></label>
     {notice&&<p className="alert alert-success" role="status">{notice}</p>}
     <button className="button button-primary" disabled={busy||!title.trim()||!message.trim()}>{busy?"Đang gửi…":"Gửi"}</button>
    </form>:<div className="support-inbox">
     <div className="support-heading"><p>{inbox.unread} thông báo chưa đọc</p><button type="button" className="outline-button" onClick={()=>void refresh()}>Làm mới</button></div>
     {inboxError&&<p role="alert">{inboxError}</p>}
     {!inbox.items.length&&!inboxError&&<p>Chưa có yêu cầu trợ giúp.</p>}
     {inbox.items.map(n=><article key={n.id} className={"support-message "+(!n.readAt?"support-unread":"")}><h3>{n.title}</h3><small>{n.senderName} · {n.department} · {new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(n.createdAt))}</small><p>{n.message}</p>{!n.readAt?<button type="button" className="outline-button" disabled={busy} onClick={()=>void markRead(n.id)}>Đánh dấu đã đọc</button>:<small>Đã đọc</small>}</article>)}
    </div>}
   </section>
  </div>}
 </div>;
}
