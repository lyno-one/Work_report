"use client";
import { useEffect,useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL??(process.env.NODE_ENV==="production"?"/api":"http://localhost:4000/api");
type Meta={id:string;name:string;size:number};
export default function EvidenceFiles({token,ids=[],disabled,onChange,onBusyChange}:{token:string;ids?:string[];disabled:boolean;onChange:(ids:string[])=>void;onBusyChange?:(busy:boolean)=>void}){
 const [meta,setMeta]=useState<Record<string,Meta>>({}),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const key=ids.join(",");
 useEffect(()=>{let active=true;for(const id of ids.filter(Boolean))void fetch(API+"/attachments/"+id+"/info",{headers:{Authorization:"Bearer "+token}}).then(async r=>{if(!r.ok)throw Error("Không đọc được thông tin file.");return r.json() as Promise<Meta>;}).then(m=>{if(active)setMeta(old=>({...old,[id]:m}));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[key,token]);
 async function upload(slot:number,file:File){
  setError("");if(file.size>5*1024*1024){setError("File tối đa 5 MB.");return;}setBusy(true);onBusyChange?.(true);
  try{const body=new FormData();body.append("file",file);const r=await fetch(API+"/attachments",{method:"POST",headers:{Authorization:"Bearer "+token},body});const m=await r.json();if(!r.ok)throw Error(m.message??"Tải file thất bại.");setMeta(old=>({...old,[m.id]:m}));const next=[ids[0]??"",ids[1]??""];next[slot]=m.id;onChange(next);}
  catch(e){setError(e instanceof Error?e.message:"Tải file thất bại.");}finally{setBusy(false);onBusyChange?.(false);}
 }
 async function download(id:string){
  setError("");try{const r=await fetch(API+"/attachments/"+id,{headers:{Authorization:"Bearer "+token}});if(!r.ok)throw Error("Không tải được file minh chứng.");const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=meta[id]?.name??"minh-chung";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:"Không tải được file.");}
 }
 return <div className="evidence-files"><p>File minh chứng · PDF, PNG, JPG, TXT · tối đa 5 MB/file</p><div className="evidence-slots">{[0,1].map(slot=><div className="evidence-slot" key={slot}><label>Minh chứng {slot+1}{!disabled&&<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" disabled={disabled||busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void upload(slot,file);}}/>}</label>{ids[slot]&&<div><button type="button" className="outline-button" onClick={()=>void download(ids[slot])}>{meta[ids[slot]]?.name??"Tải file minh chứng"}</button>{!disabled&&<button type="button" disabled={busy} onClick={()=>{const next=[ids[0]??"",ids[1]??""];next[slot]="";onChange(next);}}>Gỡ file</button>}</div>}</div>)}</div>{busy&&<p role="status">Đang tải file lên… Chờ tải xong trước khi lưu báo cáo.</p>}{error&&<p role="alert">{error}</p>}<small>Nhấn lưu hoặc gửi báo cáo để gắn các file đã tải lên.</small></div>;
}
