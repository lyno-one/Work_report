import { existsSync } from "node:fs";
import { resolve } from "node:path";
// CRM local configuration: environment supplied by the process takes precedence over local files.
for(const name of (process.env.NODE_ENV==="production"?[".env.production",".env"]:[".env.local",".env"])){
  const file=resolve(name);
  if(existsSync(file))process.loadEnvFile(file);
}
