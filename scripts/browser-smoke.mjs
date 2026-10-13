import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
const root=resolve("."),dir=mkdtempSync(join(tmpdir(),"lyno-browser-")),processes=[];
const webPort=13320,debugPort=13321;
const origin=`http://localhost:${webPort}`;
function run(args,env={}){const p=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});processes.push(p);p.stderr.on("data",d=>{if(!String(d).includes("ExperimentalWarning"))process.stderr.write(d);});return p;}
async function ready(url){for(let i=0;i<150;i++){try{const r=await fetch(url);if(r.status<500)return r;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error("Timeout: "+url);}
let ws,seq=0;const pending=new Map(),exceptions=[];
async function command(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error("CDP timeout: "+method));},10000);pending.set(id,{resolve:(data)=>{clearTimeout(timer);resolve(data);},reject:(error)=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error("Browser timeout: "+expression);}
async function login(email){const r=await fetch("http://localhost:13322/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:"LynoDemo2026!"})});assert.equal(r.status,201);const data=await r.json();await evaluate(`localStorage.setItem("lyno-token",${JSON.stringify(data.accessToken)})`);await command("Page.navigate",{url:origin});await until('!!document.querySelector(".daily-workspace")');}
async function screenshot(name){const r=await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});writeFileSync(join(root,"artifacts",name),Buffer.from(r.data,"base64"));}
try{
 run(["apps/api/dist/main.js"],{PORT:"13322",DATABASE_PATH:join(dir,"browser.sqlite"),NODE_ENV:"test",CRM_API_URL:"http://unused",CRM_SUPABASE_URL:"http://unused",CRM_SUPABASE_ANON_KEY:"test",CORS_ORIGIN:origin});
 run(["node_modules/next/dist/bin/next","start","apps/web","-p",String(webPort)]);
 await ready("http://localhost:13322/api/auth/me");console.log("API ready");await ready(origin);console.log("Web ready");
 const edge=spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",["--headless=new","--disable-gpu","--in-process-gpu","--disable-gpu-sandbox","--no-sandbox","--no-first-run","--no-default-browser-check",`--remote-debugging-port=${debugPort}`,`--user-data-dir=${join(dir,"edge")}`,"about:blank"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});processes.push(edge);edge.stderr.on("data",d=>process.stderr.write(d));console.log("Edge PID",edge.pid);
 await ready(`http://localhost:${debugPort}/json/list`);
 const pages=await (await fetch(`http://localhost:${debugPort}/json/list`)).json();
 ws=new WebSocket(pages.find(p=>p.type==="page").webSocketDebuggerUrl);
 ws.addEventListener("message",event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);}}else if(data.method==="Fetch.requestPaused"){void command("Fetch.continueRequest",{requestId:data.params.requestId,url:data.params.request.url.replace("localhost:4000","localhost:13322").replace("localhost:13320","localhost:13322")});}else if(data.method==="Runtime.exceptionThrown")exceptions.push(data.params);});
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
 console.log("CDP connected");await command("Fetch.enable",{patterns:[{urlPattern:"*localhost:4000/api/*"},{urlPattern:"*localhost:13320/api/*"}]});await command("Runtime.enable");await command("Page.enable");
 await command("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await command("Page.navigate",{url:origin});await until('!!document.querySelector(".login-layout")');

 const seedLogin=await fetch("http://localhost:13322/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"employee@lyno.demo",password:"LynoDemo2026!"})});
 const seedToken=(await seedLogin.json()).accessToken;
 const selectedDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const seedReport={date:selectedDate,title:"Progress dashboard test",summary:"",status:"submitted",tasks:[{title:"Content and progress task",expectedOutput:"Deliver",actualOutput:"Employee entered work content at 50%.",priority:"high",dueDate:selectedDate,progress:50,status:"in_progress",evidenceUrl:"",note:""}],kpis:[],blockerType:"none",blockerText:"",supportRequest:"",tomorrowPlan:"",selfScore:80,focus:"Tốt",attitude:"Chủ động",lesson:""};

 const evidenceIds=[];
 for(const name of ["seed-proof-one.txt","seed-proof-two.txt"]){
  const form=new FormData();form.append("file",new Blob(["Seed evidence"],{type:"text/plain"}),name);
  const r=await fetch("http://localhost:13322/api/attachments",{method:"POST",headers:{Authorization:"Bearer "+seedToken},body:form});assert.equal(r.status,201);evidenceIds.push((await r.json()).id);
 }
 seedReport.tasks[0].evidenceFiles=evidenceIds;

 const seeded=await fetch("http://localhost:13322/api/reports",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+seedToken},body:JSON.stringify(seedReport)});
 assert.equal(seeded.status,201);
 await login("admin@lyno.demo");
 assert.equal(await evaluate('Array.from(document.querySelectorAll("nav button")).some(b=>b.textContent.includes("Phân quyền")||b.textContent.includes("Quản lý vai trò"))'),false,"demo admin must not see permission module");
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"desktop overflow");
 assert.equal(await evaluate('Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Tạo báo cáo")'),true,"admin can create their own report");
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Tạo báo cáo").click()');
 await until('!!document.querySelector(".daily-modal")');
 await evaluate('Array.from(document.querySelectorAll(".daily-modal button")).find(b=>b.textContent==="Đóng").click()');
 await until('!!document.querySelector(".employee-task-card")');
 assert.equal(await evaluate('document.querySelector(".employee-task-card progress").value'),50);
 assert.equal(await evaluate('document.querySelector(".employee-work-content p").textContent'),"Employee entered work content at 50%.");
 await login("manager@lyno.demo");await until('!!document.querySelector(".employee-task-card")');assert.equal(await evaluate('document.querySelector(".employee-task-card progress").value'),50);
 await login("ceo@lyno.demo");await until('!!document.querySelector(".employee-task-card")');assert.equal(await evaluate('document.querySelector(".employee-work-content p").textContent'),"Employee entered work content at 50%.");
 mkdirSync(join(root,"artifacts"),{recursive:true});await screenshot("dashboard-desktop.png");

 const reportForReview=await seeded.json();
 const reviewLogin=await fetch("http://localhost:13322/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@lyno.demo",password:"LynoDemo2026!"})});
 const reviewToken=(await reviewLogin.json()).accessToken;
 const reviewed=await fetch("http://localhost:13322/api/reports/"+reportForReview.id+"/approve",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+reviewToken},body:JSON.stringify({version:reportForReview.version,result:40,responsibility:30,competency:20,improvement:10,comment:"Verify leaderboard"})});
 assert.equal(reviewed.status,201);

 await evaluate('document.querySelector(".employee-task-card button").click()');
 await until('!!document.querySelector(".daily-modal .evidence-files")');
 assert.equal(await evaluate('document.querySelectorAll(".daily-modal .evidence-files input[type=file]").length'),0);
 await until('Array.from(document.querySelectorAll(".daily-modal .evidence-files button")).some(b=>b.textContent==="seed-proof-one.txt")');
 assert.equal(await evaluate('Array.from(document.querySelectorAll(".daily-modal .evidence-files button")).find(b=>b.textContent==="seed-proof-one.txt").matches(":disabled")'),false,"reviewer download must remain enabled");
 await evaluate('Array.from(document.querySelectorAll(".daily-modal button")).find(b=>b.textContent==="Đóng").click()');

 await evaluate('Array.from(document.querySelectorAll("nav button")).find(b=>b.textContent.includes("Bảng xếp hạng")).click()');
 await until('!!document.querySelector(".leaderboard-table")');
 assert.equal(await evaluate('document.querySelector("h1").textContent'),"Bảng xếp hạng");
 assert.equal(await evaluate('document.querySelector(".leaderboard-table tbody tr td:nth-child(4)").textContent'),"100");
 await screenshot("leaderboard-desktop.png");
 await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('document.querySelector(".mobile-nav-toggle").click()');
 await until('document.querySelector(".sidebar").classList.contains("open")');
 assert.equal(await evaluate('document.querySelector(".mobile-nav-toggle").getAttribute("aria-expanded")'),"true");
 await evaluate('document.querySelector(".mobile-backdrop").click()');
 await until('!document.querySelector(".sidebar").classList.contains("open")');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"leaderboard mobile overflow");
 await screenshot("leaderboard-mobile.png");
 await command("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});

 await login("employee@lyno.demo");

 await evaluate('document.querySelector(".help-card").click()');
 await until('!!document.querySelector(".support-form")');
 await evaluate('const input=document.querySelector(".support-form input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Browser help request");input.dispatchEvent(new Event("input",{bubbles:true}));const area=document.querySelector(".support-form textarea");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(area,"Please help resolve my issue.");area.dispatchEvent(new Event("input",{bubbles:true}));');
 await until('!document.querySelector(".support-form button").disabled');
 await evaluate('document.querySelector(".support-form button").click()');
 await until('!!document.querySelector(".support-form [role=status]")');
 await evaluate('document.querySelector("[aria-label=\\"Đóng trợ giúp\\"]").click()');
 await login("manager@lyno.demo");
 await until('document.querySelector(".support-badge")?.textContent==="1"');
 await evaluate('document.querySelector(".support-inbox-button").click()');
 await until('document.querySelector(".support-message h3")?.textContent==="Browser help request"');
 await evaluate('document.querySelector(".support-message button").click()');
 await until('!document.querySelector(".support-unread")');
 await evaluate('document.querySelector("[aria-label=\\"Đóng trợ giúp\\"]").click()');
 await login("admin@lyno.demo");await until('document.querySelector(".support-badge")?.textContent==="1"');
 await evaluate('document.querySelector(".support-inbox-button").click()');
 await until('document.querySelector(".support-message h3")?.textContent==="Browser help request"');
 await screenshot("support-inbox-desktop.png");
 await evaluate('document.querySelector("[aria-label=\\"Đóng trợ giúp\\"]").click()');
 await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('document.querySelector(".help-card").click()');
 await until('!!document.querySelector(".support-form")');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"support mobile overflow");
 assert.equal(await evaluate('document.querySelector(".support-modal").getBoundingClientRect().width<=innerWidth'),true);
 await screenshot("support-mobile.png");
 await evaluate('document.querySelector("[aria-label=\\"Đóng trợ giúp\\"]").click()');
 await command("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await login("employee@lyno.demo");

 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Tạo báo cáo").click()');
 await until('!!document.querySelector(".daily-modal")');
 assert.equal(await evaluate('document.querySelectorAll(".daily-task").length'),1);

 assert.equal(await evaluate('document.querySelectorAll(".daily-modal .evidence-slot input[type=file]").length'),2);
 for(const [slot,name] of [[1,"browser-proof-one.txt"],[2,"browser-proof-two.txt"]]){
  const path=join(dir,name);writeFileSync(path,"Browser evidence "+slot);
  const doc=await command("DOM.getDocument");
  const node=await command("DOM.querySelector",{nodeId:doc.root.nodeId,selector:".daily-modal .evidence-slot:nth-child("+slot+") input"});
  await command("DOM.setFileInputFiles",{nodeId:node.nodeId,files:[path]});
  await until('Array.from(document.querySelectorAll(".daily-modal .evidence-files button")).some(b=>b.textContent==='+JSON.stringify(name)+') && !!document.querySelector(".daily-modal .evidence-slot input")');
 }

 await evaluate('Array.from(document.querySelectorAll(".daily-modal button")).find(b=>b.textContent.includes("Thêm đầu việc")).click()');
 await until('document.querySelectorAll(".daily-task").length===2');
 await evaluate('const select=Array.from(document.querySelectorAll(".daily-modal label")).find(el=>el.textContent.includes("% đã hoàn thành")).querySelector("select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(select,"50");select.dispatchEvent(new Event("change",{bubbles:true}));');
 await until('document.querySelector(".daily-modal .task-progress-bar").value===50');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".daily-modal")).overflowY'),"auto");
 await screenshot("report-desktop.png");
 await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await new Promise(r=>setTimeout(r,200));
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"mobile document overflow");
 assert.equal(await evaluate('document.querySelector(".daily-modal").getBoundingClientRect().width<=innerWidth'),true,"mobile modal overflow");
 await screenshot("report-mobile.png");
 await evaluate('Array.from(document.querySelectorAll(".daily-modal button")).find(b=>b.textContent==="Đóng").click()');
 assert.equal(await evaluate('document.body.style.overflow'),"");
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 console.log("PASS: browser desktop 1366px/mobile 390px, role actions, multi-task editor, modal scrolling, no runtime exceptions.");
 console.log("Screenshots: artifacts/dashboard-desktop.png, report-desktop.png, report-mobile.png");
}finally{
 if(ws?.readyState===1){try{await command("Browser.close");}catch{}ws.close();}
 for(const p of processes.reverse()){if(p.exitCode!==null)continue;const ended=once(p,"exit");p.kill();await Promise.race([ended,new Promise(r=>setTimeout(r,1500))]);}
}
