import { CrmService } from "../crm/crm.service";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { timingSafeEqual } from "node:crypto";
import { UsersService } from "../users/users.service";
import type { DemoUser } from "../users/user.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly crm: CrmService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: DemoUser }> {
    if (process.env.NODE_ENV !== "test") {
      throw new ForbiddenException("Đăng nhập tài khoản demo đã bị tắt");
    }
    const user = this.users.findByEmail(email);
    const expectedPassword = process.env.DEMO_PASSWORD ?? "LynoDemo2026!";

    if (user?.crmUserId || !user?.active || !this.matches(password, expectedPassword)) {
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user };
  }

  config(){return {crmEnabled:this.crm.enabled()};}
  async loginCrm(email:string,password:string){
    const {user,sessionId}=await this.crm.login(email,password);
    return {user,accessToken:await this.jwt.signAsync({sub:user.id,crmSessionId:sessionId})};
  }

  private matches(value: string, expected: string): boolean {
    const candidate = Buffer.from(value);
    const reference = Buffer.from(expected);
    return candidate.length === reference.length && timingSafeEqual(candidate, reference);
  }
}
