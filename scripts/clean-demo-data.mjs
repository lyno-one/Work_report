import { DatabaseSync } from "node:sqlite";
import { existsSync,mkdirSync } from "node:fs";
import { dirname,join,resolve } from "node:path";
const path=resolve(process.env.DATABASE_PATH??"apps/api/data/lyno.sqlite");
if(!existsSync(path)){console.log("No existing database to clean.");process.exit(0);}
const db=new DatabaseSync(path);
const read=(key,fallback)=>{const r=db.prepare("SELECT value FROM documents WHERE key=?").get(key);return r?JSON.parse(r.value):fallback;};
const users=read("users",[]),reports=read("reports",[]),support=read("support.requests",[]);
const demo=u=>/@lyno\.(demo|test)$/i.test(u.email??"");
const removedUsers=users.filter(demo),keptUsers=users.filter(u=>!demo(u));
const ids=new Set(["usr-admin","usr-ceo","usr-manager","usr-employee","usr-sale-manager","usr-hr",...removedUsers.map(u=>u.id)]);
const removedReports=reports.filter(r=>ids.has(r.authorId)),keptReports=reports.filter(r=>!ids.has(r.authorId));
const keptSupport=support.filter(r=>r.source!=="demo"&&!ids.has(r.senderId));
const attachmentRows=db.prepare("SELECT key,json_extract(value,'$.ownerId') AS owner FROM documents WHERE key LIKE 'attachment:%'").all();
const removedAttachments=attachmentRows.filter(r=>ids.has(r.owner));
const summary={removedUsers:removedUsers.length,removedReports:removedReports.length,removedHelp:support.length-keptSupport.length,removedAttachments:removedAttachments.length,retainedUsers:keptUsers.length,retainedReports:keptReports.length};
console.log(JSON.stringify(summary));
if(!process.argv.includes("--apply")){db.close();process.exit(0);}
const backupDir=join(dirname(path),"backups");mkdirSync(backupDir,{recursive:true});
const backup=join(backupDir,"before-demo-cleanup-"+new Date().toISOString().replaceAll(":","-")+".sqlite");
db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
const write=(key,v)=>db.prepare("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,JSON.stringify(v));
db.exec("BEGIN IMMEDIATE");
try{
 write("users",keptUsers);write("reports",keptReports);write("support.requests",keptSupport);
 for(const id of ids)db.prepare("DELETE FROM documents WHERE key=?").run("crm.tasks:"+id);
 for(const r of removedAttachments)db.prepare("DELETE FROM documents WHERE key=?").run(r.key);
 const names=read("crm.department-names",{}),keptDepartments=new Set(keptUsers.map(u=>u.departmentId));
 for(const u of removedUsers)if(!keptDepartments.has(u.departmentId))delete names[u.departmentId];
 write("crm.department-names",names);
 for(const id of [...ids,...removedReports.map(r=>r.id),...removedAttachments.map(r=>r.key.slice(11)),...support.filter(r=>!keptSupport.includes(r)).map(r=>r.id)])
  db.prepare("DELETE FROM audit WHERE entity=?").run(id);
 db.exec("COMMIT");
 console.log("Cleaned demo records. Backup: "+backup);
}catch(e){db.exec("ROLLBACK");throw e;}finally{db.close();}
