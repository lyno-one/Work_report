import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";

const dir=mkdtempSync(join(tmpdir(),"lyno-uat-"));
const port=14500+Math.floor(Math.random()*1000);
const base=`http://127.0.0.1:${port}/api`;
let server;
let dbPath=join(dir,"uat.sqlite");
let output="";
let checks=0;
async function start() {
 output="";
 server=spawn(process.execPath,["apps/api/dist/main.js"],{cwd:resolve("."),windowsHide:true,env:{...process.env,NODE_ENV:"test",PORT:String(port),DATABASE_PATH:dbPath},stdio:["ignore","pipe","pipe"]});
 server.stdout.on("data",d=>{output+=d;});server.stderr.on("data",d=>{output+=d;});
 for(let i=0;i<100;i++){try{const r=await fetch(base+"/auth/me");if(r.status===401)return;}catch{}if(server.exitCode!==null)throw new Error(output);await new Promise(r=>setTimeout(r,100));}
 throw new Error("API startup timed out: "+output);
}
async function stop(){if(!server||server.exitCode!==null)return;const done=once(server,"exit");server.kill();await done;}
async function api(path,token,method="GET",body,expected=200){
 const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);checks++;return data;
}
async function login(email){return (await api("/auth/login",null,"POST",{email,password:"LynoDemo2026!"},201)).accessToken;}
const payload={date:"2026-10-11",title:"UAT daily report",summary:"Results",status:"draft",tasks:[],kpis:[{code:"posts",target:0,actual:2}],blockerType:"none",blockerText:"",supportRequest:"",tomorrowPlan:"A\nB\nC",selfScore:80,focus:"T\u1ed1t",attitude:"Ch\u1ee7 \u0111\u1ed9ng",lesson:""};
const task={title:"Complete task",expectedOutput:"Deliver",actualOutput:"Delivered",priority:"high",dueDate:"2026-10-11",progress:100,status:"done",evidenceUrl:"https://example.com/proof",note:""};
try{
 await start();
 const employee=await login("employee@lyno.demo"),manager=await login("manager@lyno.demo"),admin=await login("admin@lyno.demo"),ceo=await login("ceo@lyno.demo");
 await api("/reports",null,"GET",undefined,401);
 await api("/reports/rep-1003",employee,"GET",undefined,403);
 await api("/reports/rep-1003",manager,"GET",undefined,403);
 await api("/reports",employee,"POST",{...payload,status:"submitted"},422);
 await api("/reports",employee,"POST",{...payload,tasks:[{...task,progress:90}]},422);
 await api("/reports",employee,"POST",{...payload,tasks:[{...task,actualOutput:" "}]},422);
 await api("/reports",employee,"POST",{...payload,tasks:[{...task,evidenceUrl:"javascript:alert(1)"}]},400);
 await api("/reports",employee,"POST",{...payload,date:"2026-02-30"},400);
 await api("/reports",employee,"POST",{...payload,tomorrowPlan:"A\nB\nC\nD"},400);
 await api("/reports",employee,"POST",{...payload,kpis:[{code:"revenue",target:1,actual:2}]},400);
 const adminDraft=await api("/reports",admin,"POST",{...payload,date:"2026-09-30",tasks:[{...task,dueDate:"2026-09-30"}],kpis:[]},201);
 assert.equal(adminDraft.authorId,"usr-admin");
 await api("/reports",admin,"POST",{...payload,date:"2026-09-30",kpis:[]},409);
 await api("/reports",admin,"POST",{...payload,authorId:"usr-employee",kpis:[]},400);
 const adminSubmitted=await api(`/reports/${adminDraft.id}/submit`,admin,"POST",{version:adminDraft.version},201);
 await api(`/reports/${adminDraft.id}/approve`,admin,"POST",{version:adminSubmitted.version,result:40,responsibility:30,competency:20,improvement:10,comment:"Self review"},403);
 await api("/reports",ceo,"POST",{...payload,kpis:[]},403);
 const created=await api("/reports",employee,"POST",{...payload,tasks:[task,task,task]},201);
 assert.equal(created.status,"draft");assert.equal(created.kpis[0].resultPercent,null);assert.equal(created.tasks.length,3);
 await api("/reports",employee,"POST",payload,409);

 async function upload(token,name,content,type,expected=201){
  const form=new FormData();form.append("file",new Blob([content],{type}),name);
  const r=await fetch(base+"/attachments",{method:"POST",headers:token?{Authorization:"Bearer "+token}:{},body:form});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));checks++;return data;
 }
 await upload(null,"proof.txt","Evidence","text/plain",401);
 const adminFile=await upload(admin,"proof.txt","Evidence","text/plain");
 await api(`/attachments/${adminFile.id}/info`,employee,"GET",undefined,403);
 await upload(employee,"proof.exe","Evidence","application/octet-stream",400);
 await upload(employee,"fake.png","not a PNG","image/png",400);
 await upload(employee,"big.txt","x".repeat(5*1024*1024+1),"text/plain",413);
 const fileOne=await upload(employee,"proof-one.txt","Evidence file one","text/plain");
 const fileTwo=await upload(employee,"proof-two.pdf","%PDF-1.4\nEvidence file two","application/pdf");
 assert.ok(!("data" in fileOne));assert.ok(!("ownerId" in fileOne));
 const otherToken=await login("thao@lyno.demo"),otherFile=await upload(otherToken,"private.txt","Private evidence","text/plain");
 await api("/reports/"+created.id,employee,"PUT",{...payload,version:created.version,tasks:[{...task,evidenceFiles:[otherFile.id]}]},403);
 await api("/reports/"+created.id,employee,"PUT",{...payload,version:created.version,tasks:[{...task,evidenceFiles:[fileOne.id,fileTwo.id,fileOne.id]}]},400);
 await api("/reports/"+created.id,employee,"PUT",{...payload,version:created.version,tasks:[{...task,evidenceFiles:[fileOne.id,fileOne.id]}]},400);
 await api("/attachments/"+fileOne.id+"/info",otherToken,"GET",undefined,403);

 const updated=await api(`/reports/${created.id}`,employee,"PUT",{...payload,tasks:[{...task,evidenceFiles:[fileOne.id,fileTwo.id]},task,task],version:created.version});
 await api(`/reports/${created.id}`,employee,"PUT",{...payload,version:created.version},409);
 const submitted=await api(`/reports/${created.id}/submit`,employee,"POST",{version:updated.version},201);
 const review={version:submitted.version,result:40,responsibility:30,competency:20,improvement:10,comment:"Reviewed"};
 await api(`/reports/${created.id}/approve`,employee,"POST",review,403);
 await api(`/reports/${created.id}/approve`,manager,"POST",{...review,result:41},400);
 await api(`/reports/${created.id}/approve`,manager,"POST",{...review,comment:""},400);
 await api(`/reports/${created.id}/approve`,manager,"POST",{...review,comment:" "},400);
 const approved=await api(`/reports/${created.id}/approve`,manager,"POST",review,201);

 assert.deepEqual(approved.tasks[0].evidenceFiles,[fileOne.id,fileTwo.id]);
 await api("/attachments/"+fileOne.id+"/info",manager);
 await api("/attachments/"+fileOne.id+"/info",ceo);
 const binary=await fetch(base+"/attachments/"+fileOne.id,{headers:{Authorization:"Bearer "+manager}});
 assert.equal(binary.status,200);assert.equal(await binary.text(),"Evidence file one");assert.ok(binary.headers.get("content-disposition").startsWith("attachment"));checks++;
 await api("/attachments/"+fileOne.id+"/info",otherToken,"GET",undefined,403);

 assert.equal(approved.score,100);assert.equal(approved.reviews[0].reviewerId,"usr-manager");
 await api(`/reports/${created.id}`,employee,"PUT",{...payload,version:approved.version},403);
 await api(`/reports/${created.id}/reopen`,manager,"POST",{version:approved.version,reason:" "},400);
 const reopened=await api(`/reports/${created.id}/reopen`,manager,"POST",{version:approved.version,reason:"Update results"},201);
 assert.equal(reopened.status,"reopened");assert.equal(reopened.score,null);assert.equal(reopened.reviews.length,1);
 const pendingBoard=await api("/leaderboard?month=2026-10",employee);assert.ok(!pendingBoard.yearly.some(r=>r.userId==="usr-employee"));
 const resubmitted=await api(`/reports/${created.id}`,employee,"PUT",{...payload,status:"submitted",tasks:[task],version:reopened.version});
 const final=await api(`/reports/${created.id}/approve`,ceo,"POST",{...review,version:resubmitted.version,result:0,responsibility:0,competency:0,improvement:0},201);
 assert.equal(final.score,0);assert.equal(final.reviews[1].version,2);
 const reopenedBoard=await api("/leaderboard?month=2026-10",employee);assert.equal(reopenedBoard.yearly.find(r=>r.userId==="usr-employee").yearScore,0);
 const logs=await api(`/reports/${created.id}/history`,employee);
 assert.equal(logs.length,7);assert.ok(logs.some(l=>l.action.startsWith("report.reopen")));
 const overview=await api("/reports/overview?date=2026-10-11&department_id=marketing",admin);
 assert.equal(overview.totalTasks,1);assert.equal(overview.done,1);assert.equal(overview.completion,100);assert.equal(overview.scoreSamples,1);assert.equal(overview.averageScore,0);
 const scoped=await api("/reports?department_id=sales",employee);assert.equal(scoped.length,0);
 await api("/users",ceo,"GET",undefined,403);
 await api("/users/usr-employee/role",admin,"PATCH",{role:"manager"},403);
 await api("/permissions",admin,"GET",undefined,403);
 const fresh=(await api("/auth/me",employee)).user;assert.equal(fresh.role,"employee");

 await api("/dashboard/overview?date=2026-10-11",admin);
 await api("/kpi-definitions",employee);
 await api("/me",employee);
 const csvResponse=await fetch(base+"/reports/export?date=2026-10-11",{headers:{Authorization:`Bearer ${employee}`}});
 assert.equal(csvResponse.status,200);assert.ok(csvResponse.headers.get("content-type").includes("text/csv"));assert.ok((await csvResponse.text()).includes("Nhân sự"));checks++;
 const backup=await api("/reports/export?format=json&date=2026-10-11",employee);assert.equal(backup.reports.length,1);
 await api("/reports/import",employee,"POST",{reports:[{...payload,date:"2026-10-12",authorId:"usr-hr"}]},403);
 await api("/reports/import",employee,"POST",{reports:[{...payload,date:"2026-10-12"},{...payload,date:"2026-10-12"}]},409);
 assert.equal((await api("/reports?date=2026-10-12",employee)).length,0);
 await api("/reports/import",employee,"POST",{reports:[{...payload,date:"2026-10-12"},{...payload,date:"2026-10-13"}]},201);
 assert.equal((await api("/reports?date=2026-10-12",employee))[0].status,"draft");
 await api("/reports/import",employee,"POST",{reports:[{...payload,date:"2026-10-11"}]},403);

 const codeSearch=await api("/reports?date=2026-10-11&search=LY003",admin);assert.equal(codeSearch.length,1);
 const searchOverview=await api("/dashboard/overview?date=2026-10-11&search=LY003",admin);assert.equal(searchOverview.totalPeople,1);assert.equal(searchOverview.submitted,1);

 // Leaderboard totals are derived from approved reports, with no destructive reset.
 await api("/leaderboard",null,"GET",undefined,401);
 await api("/leaderboard?month=2026-13",admin,"GET",undefined,400);
 await api("/leaderboard?month=2026-1",admin,"GET",undefined,400);
 await api("/leaderboard?month=2026-10&department_id=unknown",admin,"GET",undefined,400);
 async function scored(token,date,score){
  const r=await api("/reports",token,"POST",{...payload,date,status:"submitted",tasks:[{...task,dueDate:date}],kpis:[]},201);
  return api("/reports/"+r.id+"/approve",admin,"POST",{version:r.version,result:score/2,responsibility:score/4,competency:score/4,improvement:0,comment:"Leaderboard verification"},201);
 }
 await scored(employee,"2026-09-20",60);
 await scored(employee,"2026-11-20",80);
 await scored(employee,"2025-12-20",40);
 await scored(manager,"2026-11-20",80);
 const hrToken=await login("thao@lyno.demo");await scored(hrToken,"2026-11-20",80);
 const october=await api("/leaderboard?month=2026-10",employee);
 const ownOctober=october.monthly.find(r=>r.userId==="usr-employee");
 assert.equal(ownOctober.monthScore,0);assert.equal(ownOctober.yearScore,140);assert.equal(ownOctober.monthReports,1);
 assert.equal(october.yearly.find(r=>r.userId==="usr-manager").yearScore,166);
 assert.ok(!("tasks" in ownOctober));assert.ok(!("email" in ownOctober));
 const november=await api("/leaderboard?month=2026-11",manager);
 assert.equal(november.monthly.length,3);assert.deepEqual(november.monthly.map(r=>r.rank),[1,1,1]);
 const marketing=await api("/leaderboard?month=2026-11&department_id=marketing",employee);
 assert.equal(marketing.monthly.length,2);assert.ok(marketing.monthly.every(r=>r.departmentId==="marketing"));
 const december=await api("/leaderboard?month=2026-12",ceo);
 assert.equal(december.monthly.length,0);assert.equal(december.yearly.find(r=>r.userId==="usr-employee").yearScore,140);
 assert.equal(december.yearly.find(r=>r.userId==="usr-employee").monthScore,0);
 const previousYear=await api("/leaderboard?month=2025-12",employee);assert.equal(previousYear.yearly[0].yearScore,40);
 const newYear=await api("/leaderboard?month=2027-01",admin);assert.equal(newYear.monthly.length,0);assert.equal(newYear.yearly.length,0);


 await api("/support/requests",null,"POST",{title:"Help",message:"Need support"},401);
 await api("/support/requests",employee,"POST",{title:" ",message:"Need support"},400);
 await api("/support/requests",employee,"POST",{title:"Help",message:" ",senderId:"usr-admin"},400);
 await api("/support/requests",employee,"POST",{title:"x".repeat(121),message:"Need support"},400);
 await api("/support/notifications",employee,"GET",undefined,403);
 await api("/support/notifications",ceo,"GET",undefined,403);
 const help=await api("/support/requests",employee,"POST",{title:" Need equipment ",message:" Please help with equipment.\nThank you. "},201);
 const managerInbox=await api("/support/notifications",manager),adminInbox=await api("/support/notifications",admin);
 assert.equal(managerInbox.unread,1);assert.equal(adminInbox.unread,1);assert.equal(managerInbox.items[0].title,"Need equipment");assert.equal(managerInbox.items[0].senderId,"usr-employee");assert.ok(managerInbox.items[0].message.includes("\n"));
 const saleManager=await login("lien@lyno.demo");assert.equal((await api("/support/notifications",saleManager)).items.length,0);
 await api("/support/notifications/"+help.id+"/read",saleManager,"POST",undefined,403);
 await api("/support/notifications/"+help.id+"/read",employee,"POST",undefined,403);
 const readHelp=await api("/support/notifications/"+help.id+"/read",manager,"POST",undefined,201);
 assert.equal((await api("/support/notifications/"+help.id+"/read",manager,"POST",undefined,201)).readAt,readHelp.readAt);
 assert.equal((await api("/support/notifications",manager)).unread,0);assert.equal((await api("/support/notifications",admin)).unread,1);
 await api("/support/requests",hrToken,"POST",{title:"HR request",message:"HR help"},201);
 assert.equal((await api("/support/notifications",manager)).items.length,1);assert.equal((await api("/support/notifications",admin)).items.length,2);

 await stop();await start();
 assert.equal((await api("/support/notifications",manager)).items[0].readAt,readHelp.readAt);assert.equal((await api("/support/notifications",admin)).unread,2);
 const persistedBoard=await api("/leaderboard?month=2026-11",employee);assert.equal(persistedBoard.yearly.find(r=>r.userId==="usr-employee").yearScore,140);
 const storedFile=await fetch(base+"/attachments/"+fileOne.id,{headers:{Authorization:"Bearer "+employee}});assert.equal(storedFile.status,200);assert.equal(await storedFile.text(),"Evidence file one");checks++;
 const persisted=await api(`/reports/${created.id}`,employee);assert.equal(persisted.score,0);assert.equal(persisted.reviews.length,2);
 assert.equal((await api("/auth/me",employee)).user.role,"employee");
 assert.equal((await api(`/reports/${created.id}/history`,employee)).length,7);

 await stop();
 const backupFile=execFileSync(process.execPath,["scripts/backup.mjs"],{cwd:resolve("."),windowsHide:true,env:{...process.env,DATABASE_PATH:dbPath,BACKUP_DIR:join(dir,"backups")},encoding:"utf8"}).trim();
 dbPath=backupFile;await start();
 assert.equal((await api("/support/notifications",admin)).items.length,2);
 const restoredFile=await fetch(base+"/attachments/"+fileTwo.id,{headers:{Authorization:"Bearer "+employee}});assert.equal(restoredFile.status,200);assert.equal(await restoredFile.text(),"%PDF-1.4\nEvidence file two");checks++;
 assert.equal((await api("/reports/"+created.id,employee)).reviews.length,2);
 assert.equal((await api("/reports/"+created.id+"/history",employee)).length,7);
 assert.equal((await api("/auth/me",employee)).user.role,"employee");
 console.log(`PASS: ${checks} HTTP checks; report lifecycle, validation, RBAC, concurrency, audit and restart persistence.`);
 console.log("Isolated test database: "+dir);
}finally{await stop();}
