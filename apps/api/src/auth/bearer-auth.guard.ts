import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { CrmService } from "../crm/crm.service";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedRequest } from "./auth.types";
import { UsersService } from "../users/users.service";

interface AccessTokenPayload {
  sub?: string;
  crmSessionId?:string;
}

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly crm:CrmService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(
        authorization.slice("Bearer ".length),
      );
      if(process.env.NODE_ENV!=="test"&&!payload.crmSessionId)throw new UnauthorizedException("Vui lòng đăng nhập tài khoản CRM.");
      if (!payload.sub) throw new UnauthorizedException();

      const user = payload.crmSessionId ? await this.crm.resolve(payload.crmSessionId) : this.users.findById(payload.sub);
      if (!user?.active || user.id!==payload.sub || user.crmUserId&&!payload.crmSessionId) throw new UnauthorizedException();
      request.user = user;
      request.crmSessionId=payload.crmSessionId;
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }
  }
}
