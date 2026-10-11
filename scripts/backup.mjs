import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const source=resolve(process.env.DATABASE_PATH??"apps/api/data/lyno.sqlite");
if(!existsSync(source))throw new Error("Database does not exist: "+source);
const directory=resolve(process.env.BACKUP_DIR??join(dirname(source),"backups"));
mkdirSync(directory,{recursive:true});
const destination=join(directory,"lyno-"+new Date().toISOString().replaceAll(":","-")+".sqlite");
const db=new DatabaseSync(source,{readOnly:true});
try {db.exec("VACUUM INTO '"+destination.replaceAll("'","''")+"'");} finally {db.close();}
console.log(destination);
