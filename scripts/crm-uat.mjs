import assert from "node:assert/strict";
import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {once} from "node:events";
const profiles={
 employee:{id:"11111111-1111-4111-8111-111111111111",email:"employee@crm.test",full_name:"CRM Employee",role:"employee",active:true,phong_ban_id:"crm-marketing",position:"Marketing"},
 other:{id:"22222222-2222-4222-8222-222222222222",email:"other@crm.test",full_name:"Other Employee",role:"employee",active:true,phong_ban_id:"crm-sales",position:"Sale"},
 manager:{id:"33333333-3333-4333-8333-333333333333",email:"manager@crm.test",full_name:"CRM Manager",role:"manager",active:true,phong_ban_id:"crm-marketing",position:"Manager"},
 ceo:{id:"44444444-4444-4444-8444-444444444444",email:"ceo@crm.test",full_name:"CRM CEO",role:"admin",active:true,phong_ban_id:"crm-executive",position:"CEO"},
};
profiles.owner={...profiles.ceo,id:"55555555-5555-4555-8555-555555555555",email:"luanduiga2605@gmail.com"};
profiles.owner2={...profiles.employee,id:"66666666-6666-4666-8666-666666666666",email:"nguyenvanthanh1501bmt@gmail.com"};
const tasks=[
 {id:"crm-task-own",tieu_de:"CRM assigned task",mo_ta:"Expected output from CRM",giao_cho:profiles.employee.id,priority:"high",han:"2026-10-11",trang_thai:"mo"},
 {id:"crm-task-other",tieu_de:"Other employee task",mo_ta:"Other",giao_cho:profiles.other.id,priority:"medium",han:"2026-10-12",trang_thai:"mo"},
 {id:"crm-task-group",tieu_de:"Unassigned team task",mo_ta:null,giao_cho:null,priority:"low",han:null,trang_thai:"mo"}
];
const recurringRows=[
 {id:"repeat-own",nguoi_id:profiles.employee.id,ngay:"2026-10-11",ten:"Daily recurring task",checklist:[{ten:"Check daily results",xong:true}],trang_thai:"xong",han:"2026-10-11T10:00:00Z"},
 {id:"repeat-other",nguoi_id:profiles.other.id,ngay:"2026-10-11",ten:"Other recurring task",checklist:[],trang_thai:"dang-lam"},
 {id:"repeat-wrong-day",nguoi_id:profiles.employee.id,ngay:"2026-10-10",ten:"Previous day",checklist:[]}
];
let taskRequests=0;
const fixture=createServer(async(req,res)=>{
 let text="";for await(const chunk of req)text+=chunk;
 const json=(code,data)=>{res.writeHead(code,{"Content-Type":"application/json"});res.end(JSON.stringify(data));};
 if(req.url.startsWith("/auth/v1/token")){
  const body=JSON.parse(text);
  const role=Object.keys(profiles).find(k=>profiles[k].email===body.email);
  if(!role||body.password!=="CrmTestPassword!")return json(400,{error:"invalid_credentials"});
  return json(200,{access_token:"token:"+role,refresh_token:"refresh:"+role,user:{id:profiles[role].id},expires_in:3600});
 }
 const role=req.headers.authorization?.replace("Bearer token:","");
 if(!profiles[role]?.active)return json(401,{error:{message:"Invalid account"}});
 if(req.url==="/api/auth/me")return json(200,{data:{user:profiles[role],duocXem:["/tasks"]}});
 if(req.url==="/api/viec/nguoi-nhan")return json(200,{data:{nguoi:Object.values(profiles).map(u=>({id:u.id,full_name:u.full_name,phong:u.phong_ban_id==="crm-marketing"?"Marketing":u.phong_ban_id==="crm-sales"?"Sale":"Ban điều hành"}))}});
 if(req.url.startsWith("/api/viec/lap-lai/tien-do?ngay="))return json(200,{data:{rows:[...recurringRows,recurringRows[0]],lich:[],nguoi:[]}});
 if(req.url==="/api/viec"){taskRequests++;return json(200,{data:{mo:tasks,dong:[]}});}
 return json(404,{error:"not found"});
});
await new Promise(r=>fixture.listen(0,"127.0.0.1",r));
const upstream="http://127.0.0.1:"+fixture.address().port;
const dir=mkdtempSync(join(tmpdir(),"lyno-crm-")),port=16000+Math.floor(Math.random()*1000),base="http://127.0.0.1:"+port+"/api";
let output="",checks=0;
const server=spawn(process.execPath,["apps/api/dist/main.js"],{cwd:resolve("."),windowsHide:true,env:{...process.env,PORT:String(port),DATABASE_PATH:join(dir,"test.sqlite"),NODE_ENV:"test",CRM_API_URL:upstream+"/api",CRM_SUPABASE_URL:upstream,CRM_SUPABASE_ANON_KEY:"fixture-anon-key"},stdio:["ignore","pipe","pipe"]});
server.stdout.on("data",d=>output+=d);server.stderr.on("data",d=>output+=d);
async function api(path,token,method="GET",body,expected=200){const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,expected,method+" "+path+": "+JSON.stringify(data));checks++;return data;}
async function login(role){return (await api("/auth/crm-login",null,"POST",{email:profiles[role].email,password:"CrmTestPassword!"},201)).accessToken;}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+"/auth/config")).status===200)break;}catch{}if(server.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100));}
 assert.equal((await api("/auth/config")).crmEnabled,true);
 const wrongPassword=await api("/auth/crm-login",null,"POST",{email:profiles.employee.email,password:"wrong"},401);
 assert.match(wrongPassword.message,/Email.*CRM/);
 const employee=await login("employee"),other=await login("other"),manager=await login("manager"),ceo=await login("ceo");
 const demo=(await api("/auth/login",null,"POST",{email:"employee@lyno.demo",password:"LynoDemo2026!"},201)).accessToken;
 await api("/reports/crm-tasks?date=2026-10-11",demo,"GET",undefined,401);
 const own=await api("/reports/crm-tasks?date=2026-10-11",employee);
 assert.equal(own.length,2);assert.equal(own[1].crmTaskId,"recurring:repeat-own");assert.equal(own[1].dueDate,"2026-10-11");assert.equal(own[1].progress,0);assert.equal(own[1].expectedOutput,"Check daily results");assert.equal(own[0].crmTaskId,"crm-task-own");assert.equal(own[0].progress,0);
 const diagnostic=await api("/reports/crm-tasks?include_status=true&date=2026-10-11",employee);assert.equal(diagnostic.tasks.length,2);assert.equal(diagnostic.status.assignedOpen,1);assert.equal(diagnostic.status.recurringAssigned,1);
 const their=await api("/reports/crm-tasks?date=2026-10-11",other);assert.equal(their[0].crmTaskId,"crm-task-other");
 const definitions=await api("/kpi-definitions",employee);assert.equal(definitions.length,3);assert.ok(definitions.every(d=>d.departmentId==="crm-marketing"));
 const payload={date:"2026-10-11",title:"CRM report",summary:"",status:"submitted",tasks:[{...own[0],actualOutput:"Completed first half.\nWaiting for feedback.",progress:50}],kpis:[{code:"posts",target:10,actual:8}],blockerType:"none",blockerText:"",supportRequest:"",tomorrowPlan:"",selfScore:80,focus:"Tốt",attitude:"Chủ động",lesson:""};
 await api("/reports",employee,"POST",{...payload,tasks:[{...payload.tasks[0],crmTaskId:"crm-task-other"}]},403);
 await api("/reports",employee,"POST",{...payload,tasks:[{...payload.tasks[0],title:"Forged title"}]},403);
 await api("/reports",employee,"POST",{...payload,tasks:[payload.tasks[0],payload.tasks[0]]},403);
 await api("/reports",demo,"POST",payload,403);
 payload.tasks.push({...own[1],actualOutput:"Completed recurring daily checks.",progress:70});
 await api("/reports",employee,"POST",{...payload,date:"2026-10-10"},403);
 const report=await api("/reports",employee,"POST",payload,201);
 assert.equal(report.tasks[1].progress,70);assert.equal(report.tasks[1].actualOutput,payload.tasks[1].actualOutput);
 assert.equal(report.tasks[0].progress,50);assert.equal(report.tasks[0].actualOutput,payload.tasks[0].actualOutput);
 const kpiOverview=await api("/dashboard/overview?date=2026-10-11&department_id=crm-marketing",manager);const posts=kpiOverview.kpis.find(k=>k.code==="posts");assert.equal(posts.target,10);assert.equal(posts.actual,8);assert.equal(posts.resultPercent,80);
 await api("/reports",other,"POST",{...payload,kpis:[{code:"posts",target:10,actual:8}],tasks:[{...their[0],actualOutput:"Result",progress:50}]},400);
 const seen=await api("/reports?date=2026-10-11",manager);assert.equal(seen.length,1);assert.equal(seen[0].tasks[0].progress,50);assert.equal(seen[0].tasks[0].actualOutput,payload.tasks[0].actualOutput);assert.equal(seen[0].tasks[1].progress,70);
 await api("/reports/"+report.id,other,"GET",undefined,403);
 const executive=await api("/reports?date=2026-10-11",ceo);assert.equal(executive[0].tasks[0].progress,50);assert.equal(executive[0].tasks[1].progress,70);
 const admin=(await api("/auth/login",null,"POST",{email:"admin@lyno.demo",password:"LynoDemo2026!"},201)).accessToken;
 await api("/users/"+profiles.ceo.id+"/role",admin,"PATCH",{role:"ceo"},403);
 await api("/permissions",admin,"GET",undefined,403);
 await api("/permissions",ceo,"GET",undefined,403);
 const owner=await login("owner"),owner2=await login("owner2");
 for(const t of [owner,owner2]){await api("/permissions",t);await api("/users",t);assert.equal((await api("/auth/me",t)).user.canManagePermissions,true);}
 assert.equal((await api("/auth/me",ceo)).user.canManagePermissions,false);
 await api("/users/"+profiles.ceo.id+"/role",owner,"PATCH",{role:"ceo"});
 await api("/users/"+profiles.employee.id+"/role",owner,"PATCH",{role:"manager"},400);
 await api("/users/"+profiles.employee.id+"/role",ceo,"PATCH",{role:"manager"},403);
 profiles.owner2.email="other-email@gmail.com";await api("/permissions",owner2,"GET",undefined,403);

 assert.equal((await api("/auth/me",ceo)).user.role,"ceo");
 assert.equal((await api("/reports?date=2026-10-11",ceo))[0].tasks[0].actualOutput,payload.tasks[0].actualOutput);

 const help=await api("/support/requests",employee,"POST",{title:"CRM request",message:"Help from CRM employee"},201);
 assert.equal((await api("/support/notifications",manager)).items[0].id,help.id);
 assert.equal((await api("/support/notifications",owner)).unread,1);
 assert.equal((await api("/support/notifications",admin)).items.length,0,"Demo must not receive CRM support content");
 profiles.other.role="manager";
 assert.equal((await api("/support/notifications",other)).items.length,0);
 await api("/support/notifications/"+help.id+"/read",other,"POST",undefined,403);
 profiles.other.role="employee";
 await api("/support/notifications/"+help.id+"/read",manager,"POST",undefined,201);
 assert.equal((await api("/support/notifications",owner)).unread,1);


 const {crmTaskId:ignoredSource,...manualTask}=payload.tasks[0];
 await api("/reports",owner2,"POST",{...payload,tasks:[manualTask],kpis:[{code:"posts",target:20,actual:18}]},201);
 const combined=await api("/dashboard/overview?date=2026-10-11&department_id=crm-marketing",manager);
 const combinedPosts=combined.kpis.find(k=>k.code==="posts");
 assert.equal(combinedPosts.target,30);assert.equal(combinedPosts.actual,26);assert.ok(Math.abs(combinedPosts.resultPercent-26/30*100)<0.0001);
 const ceoKpis=await api("/dashboard/overview?date=2026-10-11&department_id=crm-marketing",ceo);
 assert.equal(ceoKpis.kpis.find(k=>k.code==="posts").actual,26);
 const wrongScope=await api("/dashboard/overview?date=2026-10-11&department_id=crm-sales",manager);assert.equal(wrongScope.kpis.length,0);
 profiles.other.phong_ban_id="unknown-department";
 const unmapped=await login("other");assert.equal((await api("/kpi-definitions",unmapped)).length,0);

 profiles.employee.active=false;
 await api("/reports",employee,"GET",undefined,401);
 assert.ok(taskRequests>=2);
 console.log("PASS: "+checks+" CRM HTTP checks; real contract mapping, assigned tasks, provenance, employee content/50% persistence, manager/CEO scope, inactive-account rejection.");
}finally{if(server.exitCode===null){const ended=once(server,"exit");server.kill();await ended;}await new Promise(r=>fixture.close(r));}
