import { Injectable } from "@nestjs/common";
import { StorageService } from "../storage.service";
import { UsersService } from "../users/users.service";
import { KPI_DEFINITIONS } from "./kpi-definitions";
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase().replace(/[^a-z0-9]/g,"");
const ALIASES:Record<string,string>={
 marketing:"marketing",phongmarketing:"marketing",sale:"sales",sales:"sales",salecskh:"sales",salescskh:"sales",kinhdoanh:"sales",phongkinhdoanh:"sales",
 it:"it",phongit:"it",congnghethongtin:"it",hr:"hr",hanhchinhhr:"hr",hanhchinhnhansu:"hr",nhansu:"hr",
 operations:"operations",kho:"operations",khovanhanh:"operations",vanhanh:"operations",design:"design",thietke:"design",thietkesanpham:"design"
};
@Injectable()
export class KpiCatalogService {
 constructor(private readonly storage:StorageService,private readonly users:UsersService){}
 all(){
  const departments={...(this.storage.read<Record<string,string>>("crm.department-names")??{})};
  for(const u of this.users.list())if(u.crmUserId&&!u.departmentId.startsWith("crm-unassigned:"))departments[u.departmentId]=u.department;
  const overrides:Record<string,string>=JSON.parse(process.env.CRM_KPI_DEPARTMENT_MAP??"{}");
  const ids=new Set(KPI_DEFINITIONS.map(d=>d.departmentId));
  const definitions=process.env.NODE_ENV==="test"?[...KPI_DEFINITIONS]:[] as typeof KPI_DEFINITIONS;
  for(const [id,name] of Object.entries(departments)){
   if(ids.has(id))continue;
   const template=overrides[id]??ALIASES[normalize(name)];
   if(!template)continue;
   if(!ids.has(template))throw new Error("CRM_KPI_DEPARTMENT_MAP contains an unknown KPI template.");
   definitions.push(...KPI_DEFINITIONS.filter(d=>d.departmentId===template).map(d=>({...d,departmentId:id})));
  }
  return definitions;
 }
}
