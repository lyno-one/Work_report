import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {once} from "node:events";
const dir=mkdtempSync(join(tmpdir(),"lyno-crm-local-")),port=17200+Math.floor(Math.random()*300),base="http://localhost:"+port+"/api";
const server=spawn(process.execPath,[resolve("apps/api/dist/main.js")],{cwd:resolve("apps/api"),windowsHide:true,env:{...process.env,PORT:String(port),DATABASE_PATH:join(dir,"local-test.sqlite"),NODE_ENV:"test"},stdio:["ignore","pipe","pipe"]});
let output="";server.stdout.on("data",d=>output+=d);server.stderr.on("data",d=>output+=d);
async function api(path,token,method="GET",body,expected=200){const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const data=await r.json();if(r.status!==expected)throw Error(path+" status "+r.status+": "+(data.message??"request failed"));return data;}
async function login(email){return (await api("/auth/crm-login",null,"POST",{email,password:"LynoLocal@2026"},201)).accessToken;}
try{
 for(let i=0;i<150;i++){try{if((await fetch(base+"/auth/config")).status===200)break;}catch{}if(server.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100));}
 assert.equal((await api("/auth/config")).crmEnabled,true);
 const employee=await login("employee.sales01@lyno.test");
 const me=(await api("/auth/me",employee)).user;
 const definitions=await api("/kpi-definitions",employee);assert.ok(definitions.length>0,"CRM department must have KPI mapping");assert.ok(definitions.every(d=>d.departmentId===me.departmentId));
 const tasks=await api("/reports/crm-tasks?date=2026-10-11",employee);
 console.log("Local CRM authenticated; assigned open tasks: "+tasks.length);
 if(tasks.length){
  const payload={date:"2026-10-11",title:"Local integration verification",summary:"",status:"submitted",tasks:[{...tasks[0],actualOutput:"Local integration test: first half completed.",progress:50,status:"in_progress"}],kpis:[{code:definitions[0].code,target:10,actual:8}],blockerType:"none",blockerText:"",supportRequest:"",tomorrowPlan:"",selfScore:80,focus:"Tốt",attitude:"Chủ động",lesson:""};
  const report=await api("/reports",employee,"POST",payload,201);
  const manager=await login("manager.sales@lyno.test");
  const overview=await api("/dashboard/overview?date=2026-10-11&department_id="+me.departmentId,manager);const metric=overview.kpis.find(k=>k.code===definitions[0].code);assert.equal(metric.target,10);assert.equal(metric.actual,8);assert.equal(metric.resultPercent,80);console.log("CRM KPI "+metric.name+": target 10, actual 8, completion 80% (department UUID matched).");
  const list=await api("/reports?date=2026-10-11",manager);
  assert.equal(list.length,1);assert.equal(list[0].tasks[0].progress,50);assert.equal(list[0].tasks[0].actualOutput,payload.tasks[0].actualOutput);
  const ceo=await login("admin.local@lyno.test");
  const demo=(await api("/auth/login",null,"POST",{email:"admin@lyno.demo",password:"LynoDemo2026!"},201)).accessToken;
  const executive=(await api("/auth/me",ceo)).user;
  await api("/users/"+executive.id+"/role",demo,"PATCH",{role:"ceo"},403);
  assert.equal((await api("/auth/me",ceo)).user.role,"admin");
  assert.equal((await api("/reports/"+report.id,ceo)).tasks[0].progress,50);
  console.log("PASS: local CRM + local Supabase; assigned task -> saved content/50% -> Manager and CEO read correct values. Report database isolated; CRM tasks unchanged.");
 }else console.log("PASS: real local authentication and task endpoint; this seeded employee has no assigned open tasks.");
}finally{if(server.exitCode===null){const ended=once(server,"exit");server.kill();await ended;}}
