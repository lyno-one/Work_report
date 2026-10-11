import { KpiCatalogService } from "./reports/kpi-catalog.service";
import { SupportController, SupportService } from "./support/support.controller";
import { AttachmentsService } from "./attachments/attachments.service";
import { AttachmentsController } from "./attachments/attachments.controller";
import { LeaderboardController } from "./leaderboard/leaderboard.controller";
import { PermissionsAccessGuard } from "./permissions/permissions-access.guard";
import { CrmService } from "./crm/crm.service";
import { StorageService } from "./storage.service";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { BearerAuthGuard } from "./auth/bearer-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { PermissionsController } from "./permissions/permissions.controller";
import { OverviewController } from "./reports/overview.controller";
import { ReportsController } from "./reports/reports.controller";
import { ReportsService } from "./reports/reports.service";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured in production");
  }
  return "local-demo-secret-not-for-production";
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: "4h" },
    }),
  ],
  controllers: [SupportController, AttachmentsController, LeaderboardController, OverviewController, AuthController, PermissionsController, ReportsController, UsersController],
  providers: [KpiCatalogService, SupportService, AttachmentsService, PermissionsAccessGuard, CrmService, StorageService, AuthService, BearerAuthGuard, ReportsService, RolesGuard, UsersService],
})
export class AppModule {}
