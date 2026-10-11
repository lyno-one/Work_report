import type { Request } from "express";
import type { DemoUser } from "../users/user.types";

export interface AuthenticatedRequest extends Request {
  user: DemoUser;
  crmSessionId?:string;
}
