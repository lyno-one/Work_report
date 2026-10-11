import { Injectable } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
@Injectable()
export class StorageService {
  private readonly db: DatabaseSync;
  constructor() {
    const path = resolve(process.env.DATABASE_PATH ?? "data/lyno.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, entity TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT, new_value TEXT, timestamp TEXT NOT NULL)");
  }
  read<T>(key:string):T|undefined {const row=this.db.prepare("SELECT value FROM documents WHERE key=?").get(key) as {value:string}|undefined;return row?JSON.parse(row.value):undefined;}
  load<T>(key: string, seed: T): T {
    const row = this.db.prepare("SELECT value FROM documents WHERE key=?").get(key) as {value: string} | undefined;
    if (row) return JSON.parse(row.value) as T;
    this.save(key, seed); return seed;
  }
  save(key: string, value: unknown) { this.db.prepare("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value)); }
  commit(key: string, value: unknown, actor: string, entity: string, action: string, before: unknown, after: unknown) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.save(key, value);
      this.db.prepare("INSERT INTO audit(actor,entity,action,old_value,new_value,timestamp) VALUES (?,?,?,?,?,?)").run(actor, entity, action, JSON.stringify(before ?? null), JSON.stringify(after ?? null), new Date().toISOString());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  commitBatch(key: string,value: unknown,entries: {actor:string;entity:string;action:string;before:unknown;after:unknown}[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.save(key,value);
      for (const e of entries) this.db.prepare("INSERT INTO audit(actor,entity,action,old_value,new_value,timestamp) VALUES (?,?,?,?,?,?)").run(e.actor,e.entity,e.action,JSON.stringify(e.before),JSON.stringify(e.after),new Date().toISOString());
      this.db.exec("COMMIT");
    } catch(error) {this.db.exec("ROLLBACK");throw error;}
  }
  history(entity: string) { return this.db.prepare("SELECT * FROM audit WHERE entity=? ORDER BY id DESC").all(entity); }
}
