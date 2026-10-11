import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { StorageService } from "../storage.service";
import type { DemoUser } from "../users/user.types";
type Upload={originalname:string;mimetype:string;buffer:Buffer;size:number};
export type StoredAttachment={id:string;ownerId:string;name:string;mime:string;size:number;uploadedAt:string;data:string};
@Injectable()
export class AttachmentsService {
 constructor(private readonly storage:StorageService){}
 get(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new NotFoundException("Không tìm thấy file.");const f=this.storage.read<StoredAttachment>("attachment:"+id);if(!f)throw new NotFoundException("Không tìm thấy file.");return f;}
 metadata(f:StoredAttachment){const {data,ownerId,...meta}=f;return meta;}
 upload(user:DemoUser,file?:Upload){
  if(!file?.buffer?.length)throw new BadRequestException("Chọn file minh chứng.");
  if(file.size>5*1024*1024)throw new BadRequestException("File tối đa 5 MB.");
  const b=file.buffer;const ext=file.originalname.toLowerCase().split(".").pop();
  const allowed=(ext==="pdf"&&file.mimetype==="application/pdf"&&b.subarray(0,5).toString()==="%PDF-")
   ||(ext==="png"&&file.mimetype==="image/png"&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   ||(["jpg","jpeg"].includes(ext??"")&&file.mimetype==="image/jpeg"&&b[0]===255&&b[1]===216&&b[2]===255)
   ||(ext==="txt"&&file.mimetype==="text/plain"&&!b.includes(0)&&!b.toString("utf8").includes("\uFFFD"));
  if(!allowed)throw new BadRequestException("Chỉ nhận PDF, PNG, JPG hoặc TXT hợp lệ.");
  const f:StoredAttachment={id:randomUUID(),ownerId:user.id,name:file.originalname.replace(/[\\/\r\n\x00-\x1f]/g,"_").slice(0,160),mime:file.mimetype,size:b.length,uploadedAt:new Date().toISOString(),data:b.toString("base64")};
  this.storage.commit("attachment:"+f.id,f,user.id,f.id,"attachment.upload",null,this.metadata(f));
  return this.metadata(f);
 }
 validate(user:DemoUser,tasks:{evidenceFiles?:string[]}[]){
  for(const t of tasks){
   if((t.evidenceFiles?.length??0)>2)throw new BadRequestException("Mỗi đầu việc tối đa hai file.");
   const ids=(t.evidenceFiles??[]).filter(Boolean);
   if(new Set(ids).size!==ids.length)throw new BadRequestException("Hai ô minh chứng phải dùng file khác nhau.");
   for(const id of ids)if(this.get(id).ownerId!==user.id)throw new ForbiddenException("Không thể gắn file của người khác.");
  }
 }
}
